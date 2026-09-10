import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, openImageBucket } from '../server/vps-storage.mjs';

test('SQLite changes survive reopening and failed batches roll back', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-vps-test-'));
  const file = join(directory, 'collection.sqlite3');
  const setup = new DatabaseSync(file);
  setup.exec('CREATE TABLE collection_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  setup.close();
  let db = openDatabase(file);
  try {
    await db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('poem', 'Versul întâi\n\nVersul doi').run();
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('new', 'draft'),
      db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('poem', 'conflict'),
    ]));
    assert.equal(await db.prepare('SELECT * FROM collection_meta WHERE key = ?').bind('new').first(), null);
    db.close();
    db = openDatabase(file);
    assert.equal((await db.prepare('SELECT value FROM collection_meta WHERE key = ?').bind('poem').first()).value, 'Versul întâi\n\nVersul doi');
    await db.batch([
      db.prepare('UPDATE collection_meta SET value = ? WHERE key = ?').bind('Revised', 'poem'),
      db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('new', 'Saved'),
    ]);
    const rows = (await db.prepare('SELECT * FROM collection_meta').all()).results;
    assert.equal(rows.length, 2);
    assert.equal(Object.getPrototypeOf(rows[0]), Object.prototype, 'RSC requires plain serializable records');
    assert.equal(Object.getPrototypeOf(await db.prepare('SELECT * FROM collection_meta LIMIT 1').first()), Object.prototype);
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
});

test('image bytes persist with streaming reads and traversal is rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-images-test-'));
  const bucket = openImageBucket(directory);
  const key = `poem-images/72766231-67aa-4db8-9123-77071144a730/${'a'.repeat(64)}`;
  const bytes = await readFile(new URL('../public/assets/blue-hour.webp', import.meta.url));
  try {
    assert.equal(await bucket.get(key), null);
    await Promise.all([bucket.put(key, bytes), bucket.put(key, bytes)]);
    const restored = await openImageBucket(directory).get(key);
    assert.equal(restored.size, bytes.length);
    assert.deepEqual(Buffer.from(await new Response(restored.body).arrayBuffer()), bytes);
    await assert.rejects(bucket.get('../../etc/passwd'), /Invalid image storage key/);
    await assert.rejects(bucket.put('../escape', bytes), /Invalid image storage key/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('missing database cannot silently create an empty production collection', () => {
  assert.throws(() => openDatabase('/nonexistent-poetio-database.sqlite3'), /Import the Poetio database/);
});
