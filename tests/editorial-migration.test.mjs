import test from 'node:test';
import {
  migrateEditorial,
  migrateBookEditorial,
  migratePoemCollection,
  migrateBookTextRecovery,
} from './migration-steps.mjs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// The owner's address is server configuration (lib/access.ts); tests use a placeholder.
process.env.POETIO_OWNER_EMAIL = 'owner@example.test';

test('text recovery migration preserves existing transcriptions, seeds once and detects partial schema', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-text-recovery-')),
    file = join(directory, 'db.sqlite3');
  let db;
  try {
    await assert.rejects(migrateBookTextRecovery(file), /Existing Poetio database required/);
    db = new DatabaseSync(file);
    for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(name => name.endsWith('.sql') && name < '0016')
      .sort())
      db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO book_files VALUES('pdf','fixture','book.pdf','application/pdf',1,'hash','owner@example.test',1);INSERT INTO book_page_texts VALUES('pdf',2,'Text verificat — ș, ț','ro',7,1)",
    );
    const before = db.prepare('SELECT * FROM book_page_texts').all();
    db.close();
    assert.equal(await migrateBookTextRecovery(file), true);
    assert.equal(await migrateBookTextRecovery(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM book_page_texts').all(), before);
    const history = () => db.prepare("SELECT * FROM content_history WHERE kind='book-text'").all();
    assert.equal(history().length, 1);
    assert.equal(history()[0].event, 'initial');
    assert.equal(JSON.parse(history()[0].snapshot).revision, 7);
    db.exec("BEGIN; UPDATE book_page_texts SET content='Other',revision=8; DELETE FROM book_page_texts; ROLLBACK;");
    assert.equal(history().length, 1);
    assert.deepEqual(db.prepare('SELECT * FROM book_page_texts').all(), before);
    db.exec('DROP TRIGGER history_book_text_update');
    db.close();
    await assert.rejects(migrateBookTextRecovery(file), /does not match the recorded migrations/);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM book_page_texts').all(), before);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    if (db?.isOpen) db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('collection index migration preserves poems, is repeatable and rejects a conflicting index', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-collection-index-')),
    file = join(directory, 'db.sqlite3');
  let db;
  try {
    await assert.rejects(migratePoemCollection(file), /Existing Poetio database required/);
    db = new DatabaseSync(file);
    for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(name => name.endsWith('.sql') && name < '0014')
      .sort())
      db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO poems (id, title, author, content, created_at, updated_at) VALUES ('poem', 'Titlu', 'Autor', 'Vers păstrat', 1, 1);",
    );
    const before = db.prepare('SELECT * FROM poems').all();
    db.close();
    assert.equal(await migratePoemCollection(file), true);
    assert.equal(await migratePoemCollection(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM poems').all(), before);
    db.exec('DROP INDEX idx_poems_collection_order; CREATE INDEX idx_poems_collection_order ON poems(content);');
    db.close();
    await assert.rejects(migratePoemCollection(file), /does not match the recorded migrations/);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM poems').all(), before);
  } finally {
    if (db?.isOpen) db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test('editorial migration captures current content once and history rolls back with failed transactions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'poetio-editorial-'));
  const file = join(dir, 'db.sqlite3');
  let db = new DatabaseSync(file);
  try {
    for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(n => n.endsWith('.sql') && n < '0011')
      .sort())
      db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO poems(id,title,author,content,revision,created_at,updated_at) VALUES('original-1','Titlu','Autor','Versuri',8,1,2)",
    );
    const before = db.prepare('SELECT * FROM poems').all();
    db.close();
    assert.equal(await migrateEditorial(file), true);
    assert.equal(await migrateEditorial(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM poems').all(), before);
    assert.equal(db.prepare('SELECT count(*) n FROM content_history').get().n, 1);
    assert.equal(JSON.parse(db.prepare('SELECT snapshot FROM content_history').get().snapshot).revision, 8);
    db.exec("BEGIN;UPDATE poems SET title='Revised', revision=9 WHERE id='original-1';ROLLBACK;");
    assert.equal(db.prepare('SELECT count(*) n FROM content_history').get().n, 1);
    assert.equal(db.prepare('SELECT title FROM poems').get().title, 'Titlu');
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (db.isOpen) db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test('book editorial migration snapshots existing books once and rolls history back atomically', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'poetio-book-history-')),
    file = join(directory, 'db.sqlite3');
  let db;
  try {
    await assert.rejects(migrateBookEditorial(file), /Existing Poetio database required/);
    db = new DatabaseSync(file);
    for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(name => name.endsWith('.sql') && name < '0013')
      .sort())
      db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO book_files VALUES('pdf','fixture','book.pdf','application/pdf',1,'hash','owner@example.test',1); INSERT INTO books(id,title,author,description,file_id,revision,created_at,updated_at) VALUES('book','Titlu','Autor','Text','pdf',8,1,2)",
    );
    const before = db.prepare('SELECT * FROM books').all();
    db.close();
    assert.equal(await migrateBookEditorial(file), true);
    assert.equal(await migrateBookEditorial(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual(db.prepare('SELECT * FROM books').all(), before);
    const history = () => db.prepare("SELECT * FROM content_history WHERE kind='book'").all();
    assert.equal(history().length, 1);
    assert.equal(history()[0].event, 'initial');
    assert.equal(JSON.parse(history()[0].snapshot).revision, 8);
    db.exec("BEGIN; UPDATE books SET title='Nou',revision=9; DELETE FROM books; ROLLBACK;");
    assert.equal(history().length, 1);
    assert.deepEqual(db.prepare('SELECT * FROM books').all(), before);
    db.exec(
      "CREATE TRIGGER reject_history BEFORE INSERT ON content_history WHEN NEW.kind='book' BEGIN SELECT RAISE(ABORT,'history unavailable'); END;",
    );
    assert.throws(
      () => db.exec("UPDATE books SET title='Nu se salvează fără istoric',revision=9"),
      /history unavailable/,
    );
    assert.deepEqual(db.prepare('SELECT * FROM books').all(), before);
    db.exec('DROP TRIGGER reject_history; DROP TRIGGER history_book_update;');
    db.close();
    await assert.rejects(migrateBookEditorial(file), /does not match the recorded migrations/);
    db = new DatabaseSync(file);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (db?.isOpen) db.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('translation migration preserves legacy content, captures provenance atomically, and rejects partial schemas', async () => {
  const { migrateTranslationProvenance } = await import('./migration-steps.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'poetio-translation-migration-')),
    file = join(directory, 'db.sqlite3');
  let db;
  try {
    await assert.rejects(migrateTranslationProvenance(file), /Existing Poetio database required/);
    db = new DatabaseSync(file);
    for (const name of (await readdir(new URL('../drizzle/', import.meta.url)))
      .filter(name => name.endsWith('.sql') && name < '0015')
      .sort())
      db.exec(await readFile(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
    db.exec(
      "INSERT INTO poems(id,title,author,content,translated_title,translated_content,revision,created_at,updated_at) VALUES('original-1','Soare','Autor','Răsare','Sun','Rises',8,1,2)",
    );
    const before = db.prepare('SELECT * FROM poems').get(),
      history = db.prepare('SELECT * FROM content_history').all();
    db.close();
    assert.equal(await migrateTranslationProvenance(file), true);
    assert.equal(await migrateTranslationProvenance(file), false);
    db = new DatabaseSync(file);
    assert.deepEqual({ ...db.prepare('SELECT * FROM poems').get() }, { ...before, translation_provenance: null });
    assert.deepEqual(db.prepare('SELECT * FROM content_history').all(), history);
    const provenance = { version: 1, origin: 'manual', sourceHash: 'a'.repeat(64), textHash: 'b'.repeat(64) };
    db.prepare('UPDATE poems SET translation_provenance=?,revision=9').run(JSON.stringify(provenance));
    assert.deepEqual(
      JSON.parse(db.prepare('SELECT snapshot FROM content_history ORDER BY id DESC LIMIT 1').get().snapshot)
        .translation_provenance,
      provenance,
    );
    const savedHistory = db.prepare('SELECT * FROM content_history').all();
    db.exec('BEGIN; UPDATE poems SET translation_provenance=NULL,revision=10; DELETE FROM poems; ROLLBACK;');
    assert.deepEqual(db.prepare('SELECT * FROM content_history').all(), savedHistory);
    db.exec('DELETE FROM poems;');
    const deleted = db.prepare('SELECT * FROM content_history ORDER BY id DESC LIMIT 1').get();
    assert.equal(deleted.event, 'deleted');
    assert.deepEqual(JSON.parse(deleted.snapshot).translation_provenance, provenance);
    db.exec('DROP TRIGGER history_poem_update;');
    db.close();
    await assert.rejects(migrateTranslationProvenance(file), /does not match the recorded migrations/);
    db = new DatabaseSync(file);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    if (db?.isOpen) db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
