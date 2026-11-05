import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { openMediaValidator } from '../server/media-validator.mjs';
import { wavFixture } from './audio-fixture.mjs';
import { mediaFixture } from './media-fixture.mjs';
const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('real decoders accept complete MP3, WAV, M4A, OGG, MP4 and WebM with bounded commands', async () => {
  const calls = [];
  const validator = openMediaValidator('/tmp/unused', { run: async (...args) => { calls.push(args); return execute(...args); } });
  for (const [bytes, kind, type] of [[wavFixture(), 'audio', 'audio/wav'], ...[['tone.mp3','audio/mpeg'],['tone.m4a','audio/mp4'],['tone.ogg','audio/ogg'],['clip.mp4','video/mp4'],['clip.webm','video/webm']].map(([file,type]) => [mediaFixture(file), type.split('/')[0], type])]) {
    const checked = await validator.checkUpload(bytes, kind, type);
    assert.equal(checked.status, 'ready'); assert.equal(checked.hash, hash(bytes)); assert.equal(checked.bytes, bytes.length);
    assert.ok(checked.duration > 0); assert.equal(checked.audioStreams, 1); assert.equal(checked.videoStreams, kind === 'video' ? 1 : 0);
    const count = calls.length;
    assert.deepEqual(await validator.checkUpload(bytes, kind, type), checked);
    assert.equal(calls.length, count, 'A successful immutable upload can be reused during its publication');
  }
  assert.equal(calls.length, 12);
  for (const [program, args, options] of calls) {
    assert.equal(program, 'prlimit'); assert.ok(args.includes('--as=805306368')); assert.ok(args.includes('--cpu=60')); assert.ok(args.includes('--fsize=0'));
    if (args.includes('ffprobe')) await assert.rejects(stat(args.at(-1)), { code: 'ENOENT' }, 'Temporary uploaded bytes are removed after validation');
    assert.equal(args[args.indexOf('-protocol_whitelist') + 1], 'file'); assert.ok(args.includes('-f')); assert.ok(options.timeout <= 90000); assert.equal(options.killSignal, 'SIGKILL');
    assert.ok(options.maxBuffer <= 256 * 1024);
    if (args.includes('ffmpeg')) { assert.ok(args.includes('-xerror')); assert.ok(args.includes('empty_output+empty_output_stream')); assert.equal(args.includes('-t'), false, 'The decoder reads the whole recording'); }
  }
});

test('empty envelopes, zero samples, truncated tails and corrupt late video packets fail validation', async () => {
  const validator = openMediaValidator('/tmp/unused');
  const mp4 = Buffer.alloc(32); mp4.writeUInt32BE(32); mp4.write('ftypisom', 4);
  const wav = Buffer.alloc(44); wav.write('RIFF'); wav.writeUInt32LE(36, 4); wav.write('WAVE', 8);
  const validVideo = mediaFixture('clip.mp4'), lateCorruption = Buffer.from(validVideo);
  // Preserve the complete MP4 boxes, metadata and first frames; damage packets
  // near the end instead of relying only on the envelope/truncation check.
  lateCorruption.fill(0xff, Math.floor(lateCorruption.length * .85), Math.floor(lateCorruption.length * .95));
  for (const [bytes, kind, type] of [[mp4,'video','video/mp4'],[wav,'audio','audio/wav'],[wavFixture(0),'audio','audio/wav'],[wavFixture().subarray(0,-4),'audio','audio/wav'],[validVideo.subarray(0,-8),'video','video/mp4'],[lateCorruption,'video','video/mp4'],[mediaFixture('tone.m4a'),'video','video/mp4']]) {
    await assert.rejects(validator.checkUpload(bytes,kind,type), { code: 'invalid' });
  }
});

test('stored files are bound to hash, size, type and filesystem stamp; durable cache survives restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-media-cache-'));
  try {
    const bytes = mediaFixture('clip.mp4'), id = crypto.randomUUID();
    const file = { id, content_hash: hash(bytes), content_type: 'video/mp4', byte_size: bytes.length, object_key: `videos/${id}/${hash(bytes)}` };
    const path = join(directory, 'videos', file.object_key);
    await mkdir(join(directory, 'videos', 'videos', id), { recursive: true }); await writeFile(path, bytes);
    const validator = openMediaValidator(directory);
    const result = await validator.validation(file, 'video'); assert.equal(result.status, 'ready');
    const restarted = openMediaValidator(directory, { run: () => { throw new Error('Valid durable cache should not decode again'); } });
    assert.deepEqual(await restarted.validation(file, 'video'), result);
    await assert.rejects(validator.validation({ ...file, byte_size: file.byte_size + 1 }, 'video'), { code: 'invalid' });
    await assert.rejects(validator.validation({ ...file, object_key: '../../etc/passwd' }, 'video'), { code: 'invalid' });
    await writeFile(path, Buffer.alloc(bytes.length));
    await assert.rejects(restarted.validation(file, 'video'), { code: 'invalid' });
    await writeFile(path, bytes); assert.equal((await validator.validation(file, 'video')).status, 'ready');
    await rm(join(directory, 'media-validation'), { recursive: true });
    assert.equal((await validator.validation(file, 'video')).status, 'ready', 'Derived cache can be rebuilt');
    await rm(path); await assert.rejects(validator.validation(file, 'video'), { code: 'invalid' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

const info = { format: { duration: '1' }, streams: [{ index: 0, codec_type: 'audio', codec_name: 'pcm_s16le', channels: 1, sample_rate: '8000' }] };
test('resource limits, unsupported codecs, empty results and missing dependencies fail closed', async () => {
  for (const [failure, code] of [[{ code:'ENOENT' },'unavailable'],[{ killed:true },'limits'],[{ signal:'SIGKILL' },'limits'],[{ code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' },'limits'],[{ code:1,stderr:'Invalid data found when processing input' },'invalid']]) {
    const validator = openMediaValidator('/tmp/unused', { run: async () => { throw failure; } });
    await assert.rejects(validator.checkUpload(wavFixture(), 'audio', 'audio/wav'), { code });
  }
  for (const [metadata, code] of [[{...info,format:{duration:'1801'}},'limits'],[{...info,streams:[{...info.streams[0],codec_name:'unknown'}]},'unsupported'],[{...info,streams:[]},'invalid'],[{...info,format:{duration:'NaN'}},'invalid']]) {
    const validator = openMediaValidator('/tmp/unused', { run: async () => ({ stdout:JSON.stringify(metadata), stderr:'' }) });
    await assert.rejects(validator.checkUpload(wavFixture(), 'audio', 'audio/wav'), { code });
  }
  const warnings = openMediaValidator('/tmp/unused', { run: async () => ({stdout:JSON.stringify(info),stderr:'corrupt packet'}) });
  await assert.rejects(warnings.checkUpload(wavFixture(), 'audio', 'audio/wav'), {code:'invalid'});
});

test('one decode job at a time, identical requests share work, and failure releases the slot', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let calls = 0;
  const validator = openMediaValidator('/tmp/unused', { run: async () => { calls++; await gate; return {stdout:JSON.stringify(info),stderr:''}; } });
  const first = validator.checkUpload(wavFixture(), 'audio', 'audio/wav');
  const duplicate = validator.checkUpload(wavFixture(), 'audio', 'audio/wav');
  await assert.rejects(validator.checkUpload(wavFixture(4000), 'audio', 'audio/wav'), {code:'unavailable'});
  release(); assert.deepEqual(await duplicate, await first); assert.equal(calls, 2);
  assert.equal((await validator.checkUpload(wavFixture(4000), 'audio', 'audio/wav')).status, 'ready');

});
