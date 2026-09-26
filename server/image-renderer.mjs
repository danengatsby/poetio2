import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280];
export const IMAGE_VARIANT_VERSION = 'webp-v1';

// Originals stay unchanged. Derivatives are disposable and keyed by content hash.
export function openImageRenderer(directory) {
  const pending = new Map();
  const queue = [];
  let active = 0;
  async function limited(task) {
    if (active >= 2) {
      if (queue.length >= 16) throw new Error('Image rendering busy');
      await new Promise(resolve => queue.push(resolve));
    } else active++;
    try { return await task(); }
    finally { const next = queue.shift(); if (next) next(); else active--; }
  }
  async function render(file, width) {
    if (!IMAGE_WIDTHS.includes(width)) throw new Error('Invalid image width');
    if (!/^poem-images\/[0-9a-f-]{36}\/[0-9a-f]{64}$/i.test(file.object_key) || file.object_key !== `poem-images/${file.id}/${file.content_hash}`) throw new Error('Invalid image path');
    const cache = join(directory, 'image-variants', IMAGE_VARIANT_VERSION, file.id, file.content_hash);
    const target = join(cache, `${width}.webp`);
    if (pending.has(target)) return pending.get(target);
    const task = (async () => {
      try { return await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return limited(async () => {
        const bytes = await sharp(join(directory, 'images', file.object_key), { limitInputPixels: 40_000_000, failOn: 'warning' })
          .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
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
