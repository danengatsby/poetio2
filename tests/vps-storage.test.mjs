import assert from 'node:assert/strict';
import {
  migrateAudioDatabase,
  migrateCommentsDatabase,
  migrateAboutCommentsDatabase,
  migrateVideoDatabase,
  migrateVideoCommentsDatabase,
  migrateBookDatabase,
  migrateBookCommentsDatabase,
  migrateCommentModeration,
} from './migration-steps.mjs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { statSync } from 'node:fs';
import { openDatabase, openImageBucket, openAudioBucket, openVideoBucket } from '../server/vps-storage.mjs';
import { wavFixture } from './audio-fixture.mjs';

test('SQLite changes survive reopening and failed batches roll back', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-vps-test-'));
  const file = join(directory, 'collection.sqlite3');
  const setup = new DatabaseSync(file);
  setup.exec('CREATE TABLE collection_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  setup.close();
  let db = openDatabase(file);
  try {
    await db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('poem', 'Versul întâi\n\nVersul doi').run();
    await assert.rejects(
      db.batch([
        db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('new', 'draft'),
        db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('poem', 'conflict'),
      ]),
    );
    assert.equal(await db.prepare('SELECT * FROM collection_meta WHERE key = ?').bind('new').first(), null);
    db.close();
    db = openDatabase(file);
    assert.equal(
      (await db.prepare('SELECT value FROM collection_meta WHERE key = ?').bind('poem').first()).value,
      'Versul întâi\n\nVersul doi',
    );
    await db.batch([
      db.prepare('UPDATE collection_meta SET value = ? WHERE key = ?').bind('Revised', 'poem'),
      db.prepare('INSERT INTO collection_meta VALUES (?, ?)').bind('new', 'Saved'),
    ]);
    const rows = (await db.prepare('SELECT * FROM collection_meta').all()).results;
    assert.equal(rows.length, 2);
    assert.equal(Object.getPrototypeOf(rows[0]), Object.prototype, 'RSC requires plain serializable records');
    assert.equal(
      Object.getPrototypeOf(await db.prepare('SELECT * FROM collection_meta LIMIT 1').first()),
      Object.prototype,
    );
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
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
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing database cannot silently create an empty production collection', () => {
  assert.throws(() => openDatabase('/nonexistent-poetio-database.sqlite3'), /Import the Poetio database/);
});

test('uploaded audio survives reopening with exact byte range reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-audio-test-'));
  const key = `poem-audio/72766231-67aa-4db8-9123-77071144a730/${'b'.repeat(64)}`;
  const bytes = wavFixture();
  try {
    await openAudioBucket(directory).put(key, bytes);
    const bucket = openAudioBucket(directory);
    const object = await bucket.get(key, { range: { offset: 44, length: 256 } });
    assert.equal(object.size, bytes.length);
    assert.deepEqual(Buffer.from(await new Response(object.body).arrayBuffer()), bytes.subarray(44, 300));
    await assert.rejects(bucket.get('../../etc/passwd'), /Invalid audio storage key/);
    assert.equal(await bucket.get(key.replace('b'.repeat(64), 'c'.repeat(64))), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('audio migration preserves existing poems and can safely run twice', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-migration-test-'));
  const file = join(directory, 'collection.sqlite3');
  let db = new DatabaseSync(file);
  try {
    for (const name of ['0000_first_blink', '0001_special_paper_doll', '0002_nice_leader'])
      db.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
    db.prepare(
      'INSERT INTO poems (id, title, author, content, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('original-1', 'Lumină', 'Autor', 'Primul vers\n\nAl doilea.', 7, 1000, 2000);
    const before = { ...db.prepare('SELECT * FROM poems').get() };
    db.close();
    assert.equal(await migrateAudioDatabase(file), true);
    assert.equal(await migrateAudioDatabase(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(
      { ...db.prepare('SELECT * FROM poems').get() },
      { ...before, audio_ro_id: null, audio_en_id: null },
    );
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('comment migration preserves poems and comments survive a database reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-comments-test-'));
  const file = join(directory, 'collection.sqlite3');
  let db = new DatabaseSync(file);
  try {
    for (const name of ['0000_first_blink', '0001_special_paper_doll', '0002_nice_leader', '0003_uploaded_audio'])
      db.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
    db.prepare(
      'INSERT INTO poems (id, title, author, content, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('original-1', 'Lumină', 'Autor', 'Primul vers', 7, 1000, 2000);
    const before = { ...db.prepare('SELECT * FROM poems').get() };
    db.close();
    assert.equal(await migrateCommentsDatabase(file), true);
    assert.equal(await migrateCommentsDatabase(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual({ ...db.prepare('SELECT * FROM poems').get() }, before);
    db.prepare('INSERT INTO poem_comments VALUES (?, ?, ?, ?, ?)').run(
      'test-comment',
      'original-1',
      'Cititor',
      'O emoție.\nMulțumesc!',
      3000,
    );
    db.close();
    db = new DatabaseSync(file);
    assert.equal(db.prepare('SELECT content FROM poem_comments').get().content, 'O emoție.\nMulțumesc!');
    db.close();
    assert.equal(await migrateAboutCommentsDatabase(file), true);
    assert.equal(await migrateAboutCommentsDatabase(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual({ ...db.prepare('SELECT * FROM poems').get() }, before);
    assert.equal(db.prepare('SELECT content FROM poem_comments').get().content, 'O emoție.\nMulțumesc!');
    db.prepare('INSERT INTO about_comments VALUES (?, ?, ?, ?)').run('about-test', 'Cititor', 'Despre Poetio', 4000);
    db.close();
    db = new DatabaseSync(file);
    assert.equal(db.prepare('SELECT content FROM about_comments').get().content, 'Despre Poetio');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('video migration preserves the collection, video files persist and serve ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-video-test-'));
  const file = join(directory, 'collection.sqlite3');
  let db = new DatabaseSync(file);
  try {
    for (const name of [
      '0000_first_blink',
      '0001_special_paper_doll',
      '0002_nice_leader',
      '0003_uploaded_audio',
      '0004_reader_comments',
      '0005_about_comments',
    ])
      db.exec(await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8'));
    db.prepare(
      'INSERT INTO poems (id, title, author, content, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('original-1', 'Poem existent', 'Autor', 'Vers', 7, 1000, 2000);
    const before = { ...db.prepare('SELECT * FROM poems').get() };
    db.close();
    assert.equal(await migrateVideoDatabase(file), true);
    assert.equal(await migrateVideoDatabase(file), false);
    assert.equal(await migrateVideoCommentsDatabase(file), true);
    assert.equal(await migrateVideoCommentsDatabase(file), false);
    assert.equal(await migrateBookDatabase(file), true);
    assert.equal(await migrateBookDatabase(file), false);
    assert.equal(await migrateBookCommentsDatabase(file), true);
    assert.equal(await migrateBookCommentsDatabase(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual({ ...db.prepare('SELECT * FROM poems').get() }, before);
    const key = `videos/72766231-67aa-4db8-9123-77071144a730/${'c'.repeat(64)}`;
    const bytes = new TextEncoder().encode('video bytes for persistence');
    await openVideoBucket(directory).put(key, bytes);
    const restored = await openVideoBucket(directory).get(key, { range: { offset: 6, length: 5 } });
    assert.deepEqual(new Uint8Array(await new Response(restored.body).arrayBuffer()), bytes.slice(6, 11));
    await assert.rejects(openVideoBucket(directory).get('../../etc/passwd'), /Invalid video storage key/);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  } finally {
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('moderation migration preserves legacy visibility and never reapproves pending or hidden comments on retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-moderation-migration-'));
  const file = join(directory, 'poetio.sqlite3');
  let db = new DatabaseSync(file);
  try {
    const files = (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(name => name.endsWith('.sql') && name < '0010')
      .sort();
    for (const name of files) db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO about_comments (id, name, content, created_at) VALUES ('legacy', 'Cititor', 'Text existent', 1000)",
    );
    db.close();
    assert.equal(await migrateCommentModeration(file), true);
    db = new DatabaseSync(file);
    assert.equal(db.prepare("SELECT status FROM about_comments WHERE id = 'legacy'").get().status, 'approved');
    for (const kind of ['poem', 'about', 'video', 'book']) {
      const columns = db.prepare(`PRAGMA table_info(${kind}_comments)`).all();
      assert.equal(columns.find(row => row.name === 'status').dflt_value, "'pending'");
    }
    db.exec(
      "UPDATE about_comments SET status = 'hidden', revision = 2 WHERE id = 'legacy'; INSERT INTO about_comments (id, name, content, created_at) VALUES ('new', 'Cititor', 'Nou', 2000)",
    );
    const before = db.prepare('SELECT * FROM about_comments ORDER BY id').all();
    db.close();
    assert.equal(await migrateCommentModeration(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM about_comments ORDER BY id').all(), before);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (db.isOpen) db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('accelerated audio and video buckets share files with the service group and name them for nginx', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-accel-test-'));
  const previousMask = process.umask(0o077);
  try {
    const key = 'videos/9834e3cf-ef2e-44bc-aa6c-05498159001c/' + 'b'.repeat(64);
    const plain = openVideoBucket(join(directory, 'plain'));
    const shared = openVideoBucket(join(directory, 'shared'), { accel: '/_poetio/media/videos/' });
    for (const bucket of [plain, shared]) await bucket.put(key, new TextEncoder().encode('film'));
    const mode = path => statSync(path).mode & 0o777;
    assert.equal(mode(join(directory, 'plain', key)), 0o600);
    assert.equal(mode(join(directory, 'plain', dirname(key))), 0o700);
    assert.equal(mode(join(directory, 'shared', key)), 0o640);
    assert.equal(mode(join(directory, 'shared', dirname(key))), 0o750);
    assert.equal(plain.accelUri, undefined);
    assert.equal(shared.accelUri(key), '/_poetio/media/videos/' + key);
    assert.throws(() => shared.accelUri('videos/../../poetio.sqlite3'), /Invalid video storage key/);
    const audioKey = 'poem-audio/3c6ed1d5-b9da-40f5-b2ff-702286b2e2cb/' + 'c'.repeat(64);
    const audioBucket = openAudioBucket(join(directory, 'audio'), { accel: '/_poetio/media/audio/' });
    await audioBucket.put(audioKey, wavFixture());
    for (const path of ['audio', 'audio/poem-audio', join('audio', dirname(audioKey))])
      assert.equal(mode(join(directory, path)), 0o750);
    assert.equal(mode(join(directory, 'audio', audioKey)), 0o640);
    assert.equal(audioBucket.accelUri(audioKey), '/_poetio/media/audio/' + audioKey);
  } finally {
    process.umask(previousMask);
    await rm(directory, { recursive: true, force: true });
  }
});
