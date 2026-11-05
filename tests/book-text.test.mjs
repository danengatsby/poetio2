import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openBookRenderer } from '../server/book-renderer.mjs';
import { migrateBookText } from '../scripts/migrate-book-text-vps.mjs';
import { bookFixture } from './book-fixture.mjs';
import sharp from 'sharp';

function imagePdf(jpeg, width, height) {
  const stream = 'q 300 0 0 400 0 0 cm /Im1 Do Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  const chunks = [Buffer.from('%PDF-1.4\n')], offsets = [];
  let length = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from('\nendobj\n')]);
    chunks.push(chunk); length += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(chunks);
}

test('text extraction follows columns, survives restart, and OCR reads an image-only PDF', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-text-'));
  const store = async bytes => {
    const id = randomUUID(), hash = createHash('sha256').update(bytes).digest('hex');
    const file = { id, content_hash: hash, object_key: `books/${id}/${hash}`, byte_size: bytes.length };
    await mkdir(join(directory, 'books', 'books', id), { recursive: true });
    await writeFile(join(directory, 'books', file.object_key), bytes);
    return file;
  };
  try {
    const renderer = openBookRenderer(directory);
    const file = await store(bookFixture());
    assert.deepEqual(await renderer.text(file, 1), { text: 'Poetio reader test', source: 'pdf' });
    assert.deepEqual(await openBookRenderer(directory).text(file, 1), { text: 'Poetio reader test', source: 'pdf' });
    for (const page of [0, -1, 1.5, 3]) assert.equal(await renderer.text(file, page), null);
    await assert.rejects(renderer.text({ ...file, object_key: '../../etc/passwd' }, 1), /Invalid book path/);
    const columns = await store(bookFixture({ stream: 'BT /F1 12 Tf 200 330 Td (Right first) Tj 0 -14 Td (Right second) Tj ET BT /F1 12 Tf 20 330 Td (Left first) Tj 0 -14 Td (Left second) Tj ET' }));
    const ordered = (await renderer.text(columns, 1)).text;
    assert.match(ordered, /Left first\s+Left second\s+Right first\s+Right second/);

    // Widely spaced verse can be ambiguous to Poppler; retain all content
    // and require editorial review instead of claiming automatic correctness.
    const ambiguous = await store(bookFixture({ stream: 'BT /F1 12 Tf 200 330 Td (Right first) Tj 0 -20 Td (Right second) Tj ET BT /F1 12 Tf 20 330 Td (Left first) Tj 0 -20 Td (Left second) Tj ET' }));
    const extracted = (await renderer.text(ambiguous, 1)).text;
    for (const line of ['Left first', 'Left second', 'Right first', 'Right second']) assert(extracted.includes(line));

    const jpeg = await renderer.page(file, 1), meta = await sharp(jpeg).metadata();
    const scanned = await store(imagePdf(jpeg, meta.width, meta.height));
    const recognized = await renderer.text(scanned, 1);
    assert.equal(recognized.source, 'ocr');
    assert.match(recognized.text, /Poetio reader test/i);
    assert.equal((await renderer.text(file, 1, true)).source, 'ocr', 'An administrator can OCR a mixed page even when a text layer exists');
    const blank = await store(bookFixture({ stream: '' }));
    assert.deepEqual(await renderer.text(blank, 1), { text: '', source: 'ocr' });
    const broken = await store(bookFixture({ brokenSecondPage: true }));
    await assert.rejects(renderer.text(broken, 2), { code: 'invalid' });

    const originalPath = process.env.PATH;
    try {
      process.env.PATH = directory;
      assert.deepEqual(await openBookRenderer(directory).text(scanned, 1), recognized, 'Cached OCR remains readable without launching a process');
      await assert.rejects(renderer.text(await store(bookFixture({ stream: 'BT /F1 12 Tf 10 30 Td (Uncached) Tj ET' })), 1), { code: 'unavailable' });
    } finally { process.env.PATH = originalPath; }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('book text migration preserves data, can be repeated and rejects incompatible partial tables', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-text-migration-'));
  const file = join(directory, 'poetio.sqlite3');
  try {
    assert.throws(() => migrateBookText(file), /existing/);
    let db = new DatabaseSync(file);
    db.exec('CREATE TABLE book_files (id TEXT PRIMARY KEY); INSERT INTO book_files VALUES (\'original\');'); db.close();
    assert.equal(migrateBookText(file), true);
    db = new DatabaseSync(file);
    db.prepare('INSERT INTO book_page_texts VALUES (?, ?, ?, ?, ?, ?)').run('original', 1, 'Text verificat — ș, ț.', 'ro', 1, 1); db.close();
    assert.equal(migrateBookText(file), false);
    db = new DatabaseSync(file);
    assert.equal(db.prepare('SELECT content FROM book_page_texts').get().content, 'Text verificat — ș, ț.');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.exec('DROP TABLE book_page_texts; CREATE TABLE book_page_texts(file_id TEXT);'); db.close();
    assert.throws(() => migrateBookText(file), /Unexpected/);
    assert.match(await readFile(new URL('../drizzle/0012_book_page_texts.sql', import.meta.url), 'utf8'), /ON DELETE cascade/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
