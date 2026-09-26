import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { openImageRenderer } from '../server/image-renderer.mjs';

test('WebP derivatives resize, preserve originals, survive reopen and deduplicate concurrent renders', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-image-test-'));
  try {
    const source = await readFile(new URL('../public/assets/blue-hour.webp', import.meta.url));
    const file = { id: randomUUID(), content_hash: createHash('sha256').update(source).digest('hex') };
    file.object_key = `poem-images/${file.id}/${file.content_hash}`;
    await mkdir(join(directory, 'images', 'poem-images', file.id), { recursive: true });
    const original = join(directory, 'images', file.object_key); await writeFile(original, source);
    const renderer = openImageRenderer(directory);
    const [a, b] = await Promise.all([renderer.render(file, 320), renderer.render(file, 320)]);
    assert.deepEqual(a, b); assert.equal((await sharp(a).metadata()).width, 320); assert.equal((await sharp(a).metadata()).format, 'webp');
    assert.ok(a.length < source.length / 3); assert.deepEqual(await readFile(original), source);
    assert.deepEqual(await openImageRenderer(directory).render(file, 320), a);
    const cache = join(directory, 'image-variants', 'webp-v1', file.id, file.content_hash);
    assert.deepEqual(await readdir(cache), ['320.webp']);
    for (const width of [0, 321, -1, Infinity]) await assert.rejects(renderer.render(file, width), /Invalid image width/);
    await assert.rejects(renderer.render({ ...file, object_key: '../etc/passwd' }, 320), /Invalid image path/);
    await assert.rejects(renderer.render({ ...file, content_hash: 'b'.repeat(64) }, 320), /Invalid image path/);
    // Regenerating a disposable cache yields the same bytes, hence the same ETag.
    await rm(join(directory, 'image-variants'), { recursive: true });
    assert.deepEqual(await renderer.render(file, 320), a);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('small oriented uploads are not enlarged and failed input does not poison the cache', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-image-small-'));
  try {
    const source = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#254fb4' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const file = { id: randomUUID(), content_hash: createHash('sha256').update(source).digest('hex') };
    file.object_key = `poem-images/${file.id}/${file.content_hash}`;
    await mkdir(join(directory, 'images', 'poem-images', file.id), { recursive: true });
    const path = join(directory, 'images', file.object_key);
    const renderer = openImageRenderer(directory);
    await writeFile(path, 'not an image'); await assert.rejects(renderer.render(file, 320));
    await writeFile(path, source);
    const metadata = await sharp(await renderer.render(file, 320)).metadata();
    assert.equal(metadata.width, 40); assert.equal(metadata.height, 80); assert.equal(metadata.orientation, undefined);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
