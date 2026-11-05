import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

const execute = promisify(execFile);
const POLICY_VERSION = 1;
const MAX_PIXELS = 3840 * 2160;
const MAX_DURATION = 1800;
const maxBytes = kind => (kind === 'audio' ? 25 : 100) * 1024 * 1024;
const formats = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/mp4': 'mov', 'audio/ogg': 'ogg', 'video/mp4': 'mov', 'video/webm': 'matroska' };
const hashOf = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = file => `${file.dev}:${file.ino}:${file.size}:${file.mtimeMs}:${file.ctimeMs}`;
class MediaCheckError extends Error {
  constructor(code) { super(`Media verification: ${code}`); this.code = code; }
}
function envelope(bytes, contentType) {
  if (contentType === 'audio/wav') {
    if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new MediaCheckError('invalid');
    let offset = 12, data = 0;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) throw new MediaCheckError('invalid');
      const size = bytes.readUInt32LE(offset + 4);
      if (bytes.toString('ascii', offset, offset + 4) === 'data') data += size;
      offset += 8 + size + size % 2;
      if (offset > bytes.length) throw new MediaCheckError('invalid');
    }
    if (!data) throw new MediaCheckError('invalid');
  }
  if (contentType.endsWith('/mp4')) {
    let offset = 0, movie = false, data = false;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) throw new MediaCheckError('invalid');
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      let size = bytes.readUInt32BE(offset), header = 8;
      if (size === 1) {
        if (offset + 16 > bytes.length) throw new MediaCheckError('invalid');
        size = Number(bytes.readBigUInt64BE(offset + 8)); header = 16;
      } else if (size === 0) size = bytes.length - offset;
      if (!Number.isSafeInteger(size) || size < header || offset + size > bytes.length) throw new MediaCheckError('invalid');
      movie ||= type === 'moov'; data ||= type === 'mdat' && size > header;
      offset += size;
    }
    if (!movie || !data) throw new MediaCheckError('invalid');
  }
}
function streamsOf(info, kind, contentType) {
  const streams = info?.streams;
  if (!Array.isArray(streams) || streams.length > 8) throw new MediaCheckError('invalid');
  const audio = streams.filter(s => s.codec_type === 'audio');
  const video = streams.filter(s => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  if (kind === 'audio' ? audio.length !== 1 || video.length !== 0 : video.length !== 1 || audio.length > 1) throw new MediaCheckError('invalid');
  const duration = Number(info.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new MediaCheckError('invalid');
  if (duration > MAX_DURATION) throw new MediaCheckError('limits');
  const audioCodecs = { 'audio/mpeg': ['mp3'], 'audio/wav': ['pcm_u8', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_f32le'], 'audio/mp4': ['aac'], 'audio/ogg': ['opus', 'vorbis'], 'video/mp4': ['aac'], 'video/webm': ['opus', 'vorbis'] };
  for (const stream of audio) {
    if (!audioCodecs[contentType]?.includes(stream.codec_name)) throw new MediaCheckError('unsupported');
    if (!Number.isSafeInteger(stream.channels) || stream.channels < 1 || stream.channels > 8 || !Number.isFinite(Number(stream.sample_rate)) || Number(stream.sample_rate) <= 0 || Number(stream.sample_rate) > 192000) throw new MediaCheckError('limits');
  }
  for (const stream of video) {
    if (!(contentType === 'video/mp4' ? ['h264'] : ['vp8', 'vp9']).includes(stream.codec_name) || stream.pix_fmt !== 'yuv420p') throw new MediaCheckError('unsupported');
    const [n, d] = String(stream.r_frame_rate).split('/').map(Number), fps = n / d;
    if (!Number.isSafeInteger(stream.width) || !Number.isSafeInteger(stream.height) || stream.width < 1 || stream.height < 1 || stream.width * stream.height > MAX_PIXELS || !Number.isFinite(fps) || fps <= 0 || fps > 60) throw new MediaCheckError('limits');
  }
  return { audio, video, duration };
}

export function openMediaValidator(directory, { run = execute } = {}) {
  let active = false;
  const recent = new Map();
  const pending = new Map();
  async function command(binary, args, timeout) {
    try {
      const result = await run('prlimit', ['--as=805306368', '--cpu=60', '--fsize=0', '--', binary, ...args], {
        encoding: 'utf8', timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024,
        env: { ...process.env, LC_ALL: 'C', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' },
      });
      // With loglevel=error, any diagnostic means a decoder/demuxer error,
      // even on FFmpeg versions that recover and exit successfully.
      if (result.stderr.trim()) throw new MediaCheckError('invalid');
      return result.stdout;
    } catch (error) {
      if (error instanceof MediaCheckError) throw error;
      const diagnostic = String(error.stderr || '');
      if (error.code === 'ENOENT' || /failed to execute|not permitted|shared libraries|Unrecognized option|Option not found/i.test(diagnostic)) throw new MediaCheckError('unavailable');
      if (error.killed || error.signal || error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' || /out of memory|cannot allocate memory/i.test(diagnostic)) throw new MediaCheckError('limits');
      throw new MediaCheckError('invalid');
    }
  }
  async function checkUpload(input, kind, contentType) {
    if (!['audio', 'video'].includes(kind) || !formats[contentType] || !contentType.startsWith(kind + '/')) throw new MediaCheckError('unsupported');
    const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    if (!bytes.length || bytes.length > maxBytes(kind)) throw new MediaCheckError('limits');
    const hash = hashOf(bytes), key = `${kind}:${contentType}:${hash}`;
    if (recent.has(key)) return { ...recent.get(key) };
    if (pending.has(key)) return pending.get(key);
    if (active) throw new MediaCheckError('unavailable');
    active = true;
    const work = (async () => {
      let temporary;
      try {
        envelope(bytes, contentType);
        temporary = await mkdtemp(join(tmpdir(), 'poetio-media-'));
        const source = join(temporary, 'input');
        await writeFile(source, bytes, { mode: 0o600 });
        // Force the declared demuxer and disable MOV external references.
        // Uploaded content cannot select a playlist, network protocol or path.
        const inputOptions = ['-protocol_whitelist', 'file', '-f', formats[contentType], ...(formats[contentType] === 'mov' ? ['-enable_drefs', '0', '-use_absolute_path', '0'] : []), '-threads', '1', '-err_detect', 'explode'];
        const metadata = await command('ffprobe', ['-v', 'error', ...inputOptions, '-show_entries', 'format=duration:stream=index,codec_name,codec_type,width,height,pix_fmt,channels,sample_rate,r_frame_rate:stream_disposition=attached_pic', '-of', 'json', source], 15000);
        const { audio, video, duration } = streamsOf(JSON.parse(metadata), kind, contentType);
        const maps = [...video, ...audio].flatMap(stream => ['-map', `0:${stream.index}`]);
        await command('ffmpeg', ['-v', 'error', '-nostdin', '-xerror', '-max_error_rate', '0', '-abort_on', 'empty_output+empty_output_stream', ...inputOptions, '-i', source, ...maps, '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1', '-f', 'null', '-'], 90000);
        const result = { status: 'ready', kind, hash, bytes: bytes.length, duration, audioStreams: audio.length, videoStreams: video.length };
        recent.set(key, result);
        if (recent.size > 32) recent.delete(recent.keys().next().value);
        return { ...result };
      } finally { if (temporary) await rm(temporary, { recursive: true, force: true }); }
    })();
    pending.set(key, work);
    try { return await work; }
    finally { pending.delete(key); active = false; }
  }
  async function validation(file, kind) {
    const prefix = kind === 'audio' ? 'poem-audio' : 'videos';
    if (!['audio', 'video'].includes(kind) || !/^[0-9a-f-]{36}$/i.test(file.id) || !/^[0-9a-f]{64}$/.test(file.content_hash) || file.object_key !== `${prefix}/${file.id}/${file.content_hash}`) throw new MediaCheckError('invalid');
    const source = join(directory, kind === 'audio' ? 'audio' : 'videos', file.object_key);
    const cache = join(directory, 'media-validation', `v${POLICY_VERSION}`, kind, file.id, file.content_hash);
    try {
      const details = await stat(source), sourceStamp = stamp(details);
      if (!details.isFile() || details.size !== file.byte_size || details.size > maxBytes(kind)) throw new MediaCheckError('invalid');
      try {
        const saved = JSON.parse(await readFile(join(cache, 'ready.json'), 'utf8'));
        if (saved.version === POLICY_VERSION && saved.sourceStamp === sourceStamp && saved.contentType === file.content_type && saved.result?.hash === file.content_hash && saved.result.bytes === file.byte_size) return saved.result;
      } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      const bytes = await readFile(source);
      if (bytes.length !== file.byte_size || hashOf(bytes) !== file.content_hash) throw new MediaCheckError('invalid');
      const result = await checkUpload(bytes, kind, file.content_type);
      if (stamp(await stat(source)) !== sourceStamp) throw new MediaCheckError('invalid');
      await mkdir(cache, { recursive: true, mode: 0o700 });
      const target = join(cache, 'ready.json'), temp = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temp, JSON.stringify({ version: POLICY_VERSION, sourceStamp, contentType: file.content_type, result }), { mode: 0o600 });
        await rename(temp, target);
      } finally { await rm(temp, { force: true }); }
      return result;
    } catch (error) {
      if (error instanceof MediaCheckError) throw error;
      throw new MediaCheckError(error.code === 'ENOENT' ? 'invalid' : 'unavailable');
    }
  }
  return { checkUpload, validation };
}
