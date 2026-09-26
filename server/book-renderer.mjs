import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const execute = promisify(execFile);
export function openBookRenderer(directory) {
  const pending = new Map();
  let active = 0;
  const queue = [];
  async function limited(task) {
    if (active >= 2) {
      if (queue.length >= 16) throw new Error('Book rendering busy');
      await new Promise(resolve => queue.push(resolve));
    } else active++;
    try { return await task(); }
    finally { const next = queue.shift(); if (next) next(); else active--; }
  }
  function paths(file) {
    if (!/^books\/[0-9a-f-]{36}\/[0-9a-f]{64}$/i.test(file.object_key) || file.object_key !== `books/${file.id}/${file.content_hash}`) throw new Error('Invalid book path');
    return { source: join(directory, 'books', file.object_key), cache: join(directory, 'book-pages', 'v2', file.id, file.content_hash) };
  }
  async function once(key, task) {
    if (pending.has(key)) return pending.get(key);
    const result = task(); pending.set(key, result);
    try { return await result; } finally { pending.delete(key); }
  }
  async function atomic(path, data) {
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, data, { mode: 0o600 }); await rename(temp, path);
  }
  async function info(file) {
    const { source, cache } = paths(file);
    return once(`${cache}:info`, async () => {
      try { const data = JSON.parse(await readFile(join(cache, 'info.json'), 'utf8')); if (Number.isSafeInteger(data.pages) && data.pages > 0) return data; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const { stdout } = await limited(() => execute('pdfinfo', [source], { timeout: 20000, maxBuffer: 128 * 1024, env: { ...process.env, LC_ALL: 'C' } }));
      const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
      if (!Number.isSafeInteger(pages) || pages < 1) throw new Error('Book pages unavailable');
      await mkdir(cache, { recursive: true, mode: 0o700 }); await atomic(join(cache, 'info.json'), JSON.stringify({ pages }));
      return { pages };
    });
  }
  async function page(file, number) {
    const { source, cache } = paths(file);
    const { pages } = await info(file);
    if (!Number.isSafeInteger(number) || number < 1 || number > pages) return null;
    return once(`${cache}:${number}`, async () => {
      const target = join(cache, `${number}.jpg`);
      try { return await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      return limited(async () => {
        const { stdout } = await execute('pdftoppm', ['-f', String(number), '-l', String(number), '-singlefile', '-scale-to', '1800', '-jpeg', source], { encoding: 'buffer', timeout: 60000, maxBuffer: 20 * 1024 * 1024 });
        const image = await sharp(stdout).jpeg({ quality: 88 }).toBuffer();
        await atomic(target, image); return image;
      });
    });
  }
  return { info, page };
}
