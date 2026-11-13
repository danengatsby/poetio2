import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execute = promisify(execFile);
export const VIDEO_POSTER_VERSION = 'jpeg-v1';
const formats = { 'video/mp4': 'mov', 'video/webm': 'matroska' };
const MAX_POSTER_BYTES = 2 * 1024 * 1024;

// A still frame stands in for the video in lists, players and link previews,
// so visitors download a few dozen kilobytes instead of the start of the film.
// Stills are disposable derivatives keyed by the immutable content hash.
export function openVideoPoster(directory, { run = execute } = {}) {
  const pending = new Map();
  const queue = [];
  let active = false;
  async function limited(task) {
    if (active) {
      if (queue.length >= 32) throw new Error('Video poster rendering busy');
      await new Promise(resolve => queue.push(resolve));
    } else active = true;
    try { return await task(); }
    finally { const next = queue.shift(); if (next) next(); else active = false; }
  }
  // Same containment as media validation: forced demuxer, local files only,
  // bounded memory and CPU, and no permission to create files. The frame is
  // returned on standard output.
  async function frame(source, format, seconds) {
    const result = await run('prlimit', ['--as=805306368', '--cpu=20', '--fsize=0', '--', 'ffmpeg',
      '-v', 'error', '-nostdin', '-protocol_whitelist', 'file', '-f', format,
      ...(format === 'mov' ? ['-enable_drefs', '0', '-use_absolute_path', '0'] : []),
      '-threads', '1', '-ss', String(seconds), '-i', source,
      '-map', '0:v:0', '-frames:v', '1', '-an', '-sn', '-dn',
      '-vf', 'scale=w=min(720\\,iw):h=-2', '-pix_fmt', 'yuvj420p', '-threads', '1',
      '-c:v', 'mjpeg', '-q:v', '4', '-f', 'image2pipe', 'pipe:1'], {
      encoding: 'buffer', timeout: 30000, killSignal: 'SIGKILL', maxBuffer: MAX_POSTER_BYTES,
      env: { ...process.env, LC_ALL: 'C', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' },
    });
    const bytes = Buffer.from(result.stdout);
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
  }
  async function render(file) {
    const format = formats[file.content_type];
    if (!format || !/^videos\/[0-9a-f-]{36}\/[0-9a-f]{64}$/i.test(file.object_key) || file.object_key !== `videos/${file.id}/${file.content_hash}`) throw new Error('Invalid video path');
    const cache = join(directory, 'video-posters', VIDEO_POSTER_VERSION, file.id);
    const target = join(cache, `${file.content_hash}.jpg`);
    if (pending.has(target)) return pending.get(target);
    const task = (async () => {
      try { return await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return limited(async () => {
        const source = join(directory, 'videos', file.object_key);
        const details = await stat(source);
        if (!details.isFile() || details.size !== file.byte_size) throw new Error('Video file unavailable');
        // One second in avoids the black or fading first frame of many films;
        // clips shorter than that fall back to their opening frame.
        const bytes = await frame(source, format, 1) ?? await frame(source, format, 0);
        if (!bytes) throw new Error('Video frame unavailable');
        await mkdir(cache, { recursive: true, mode: 0o700 });
        const temporary = `${target}.${randomUUID()}.tmp`;
        try { await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 }); await rename(temporary, target); }
        finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
        return bytes;
      });
    })();
    pending.set(target, task);
    try { return await task; } finally { pending.delete(target); }
  }
  return { render };
}
