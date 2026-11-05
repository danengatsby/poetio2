import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { openDatabase } from '../server/vps-storage.mjs';
import { migrateSearch } from '../scripts/migrate-search-vps.mjs';

const compiled = mkdtempSync(join(tmpdir(), 'poetio-search-code-'));
writeFileSync(join(compiled, 'package.json'), '{"type":"commonjs"}');
for (const folder of ['db', 'lib']) {
  mkdirSync(join(compiled, folder));
  for (const file of readdirSync(new URL('../' + folder, import.meta.url)).filter(file => file.endsWith('.ts'))) {
    writeFileSync(join(compiled, folder, file.replace(/\.ts$/, '.js')), ts.transpileModule(readFileSync(new URL('../' + folder + '/' + file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
  }
}
process.on('exit', () => rmSync(compiled, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { createBookSearch } = require(join(compiled, 'db/book-search.js'));
const { listPoemCards } = require(join(compiled, 'db/poem-collection.js'));
const { listAdminPoems } = require(join(compiled, 'db/poem-admin-list.js'));
const { sitemapEntries } = require(join(compiled, 'db/sitemap.js'));
const { sqlFoldSearch, foldSearch } = require(join(compiled, 'lib/poem-search.js'));
const migrations = readdirSync(new URL('../drizzle', import.meta.url)).filter(file => file.endsWith('.sql')).sort();

function fixture(t, latest = true) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-search-db-')), path = join(directory, 'data.sqlite3');
  const sqlite = new DatabaseSync(path);
  for (const name of migrations.filter(name => latest || name < '0017')) sqlite.exec(readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  sqlite.exec("INSERT INTO collection_meta VALUES ('initial_poems_v1','complete'),('poem_languages_v1','complete')");
  t.after(() => { sqlite.close(); rmSync(directory, { recursive: true, force: true }); });
  return { sqlite, path };
}
function poem(sqlite, content, title = 'Poem') {
  const id = crypto.randomUUID();
  sqlite.prepare('INSERT INTO poems (id,title,author,theme,content,translated_title,translated_theme,translated_content,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, 'Ștefan', 'Lumină', content, 'English', 'Light', 'Translated words', 1, 1);
  return id;
}
function file(sqlite) {
  const id = crypto.randomUUID();
  sqlite.prepare('INSERT INTO book_files VALUES(?,?,?,?,?,?,?,?)').run(id, 'fixture', 'book.pdf', 'application/pdf', 1, 'hash', 'pensio53@gmail.com', 1);
  return { id, owner_email: 'pensio53@gmail.com', content_hash: 'hash' };
}

test('search migration preserves published records and history, is repeatable, and detects partial schemas', t => {
  const { sqlite, path } = fixture(t, false);
  const id = poem(sqlite, 'Şir de versuri — țară'), book = file(sqlite);
  sqlite.prepare('INSERT INTO book_page_texts VALUES(?,?,?,?,?,?)').run(book.id, 1, 'Corectură verificată', 'ro', 3, 1);
  const poems = sqlite.prepare('SELECT * FROM poems').all(), history = sqlite.prepare('SELECT * FROM content_history').all();
  assert.equal(migrateSearch(path), true); assert.equal(migrateSearch(path), false);
  assert.deepEqual(sqlite.prepare('SELECT * FROM poems').all(), poems);
  assert.deepEqual(sqlite.prepare('SELECT * FROM content_history').all(), history);
  assert.equal(sqlite.prepare('SELECT content FROM poem_search WHERE poem_id=?').get(id).content, 'sir de versuri — tara');
  assert.equal(sqlite.prepare('SELECT content FROM book_search_pages').get().content, 'Corectură verificată');
  sqlite.exec("BEGIN; UPDATE poems SET content='Altă versiune'; ROLLBACK");
  assert.equal(sqlite.prepare('SELECT content FROM poem_search').get().content, 'sir de versuri — tara');
  assert.equal(sqlite.prepare('SELECT rowid FROM poem_search_fts WHERE poem_search_fts MATCH ?').all('"versiune"').length, 0);
  sqlite.exec('DROP TRIGGER poem_search_update');
  assert.throws(() => migrateSearch(path), /Partial/);
});

test('indexed poem searches preserve literal substring, diacritic, short-query and theme semantics through edits and deletes', async t => {
  const { sqlite, path } = fixture(t), db = openDatabase(path); t.after(() => db.close());
  poem(sqlite, 'Șir și Ţară\n100% [dar] "NOT" OR luna\nabc def 😀😀😀');
  const other = poem(sqlite, 'Doar alt text', 'O întoarcere');
  for (const query of ['sir','țară','și','a','100%','[dar]','"NOT"','OR','bc d','😀😀😀','absent','a\0b']) {
    const columns = ['title','content','translated_title','translated_content'];
    const expected = sqlite.prepare(`SELECT id FROM poems WHERE ${columns.map(column => `instr(${sqlFoldSearch(column)}, ?) > 0`).join(' OR ')} ORDER BY created_at,id`).all(...columns.map(() => foldSearch(query))).map(row => row.id);
    assert.deepEqual((await listPoemCards(db, { q: query })).poems.map(row => row.id), expected, query);
  }
  assert.equal((await listPoemCards(db, { theme: 'lumina' })).total, 2);
  assert.equal((await listAdminPoems(db, { q: 'stefan' })).total, 2);
  sqlite.prepare('UPDATE poems SET content=? WHERE id=?').run('Expresie proaspătă', other);
  assert.equal((await listPoemCards(db, { q: 'proaspata' })).total, 1);
  sqlite.prepare('DELETE FROM poems WHERE id=?').run(other);
  assert.equal((await listPoemCards(db, { q: 'proaspata' })).total, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM poem_search').get().n, 1);
});

test('book searches paginate reusable text, survive service recreation and expose current corrections immediately', async t => {
  const { sqlite, path } = fixture(t), db = openDatabase(path); t.after(() => db.close());
  const book = file(sqlite); let calls = 0;
  const renderer = { info: async () => ({ pages: 45 }), text: async (_, page) => { calls++; return { text: `Șir de versuri ${page}`, source: 'pdf' }; } };
  const service = createBookSearch(db, renderer);
  assert.equal((await service.search(book, 'sir')).status, 'preparing'); await service.idle();
  const first = await service.search(book, 'sir'), second = await service.search(book, 'sir', 20), third = await service.search(book, 'sir', 40);
  assert.equal(first.total, 45); assert(first.hasMore); assert.equal(first.results.length, 20);
  assert.equal(new Set([...first.results, ...second.results, ...third.results].map(row => row.page)).size, 45);
  assert.equal(calls, 45);
  const restarted = createBookSearch(db, { info: () => { throw new Error('Already prepared'); }, text: renderer.text });
  assert.equal((await restarted.search(book, 'versuri')).status, 'ready'); assert.equal(calls, 45);
  sqlite.prepare('INSERT INTO book_page_texts VALUES(?,?,?,?,?,?)').run(book.id, 2, 'Corectură unică', 'ro', 1, 1);
  assert.equal((await restarted.search(book, 'unica')).results[0].page, 2);
  assert.equal((await restarted.search(book, 'versuri')).total, 44);
  sqlite.prepare('UPDATE book_page_texts SET content=?,revision=2 WHERE file_id=?').run('Revizie nouă', book.id);
  assert.equal((await restarted.search(book, 'unica')).total, 0);
  assert.equal((await restarted.search(book, 'revizie')).total, 1);
});

test('missing book pages stay explicit, retry only missing work, and corrections win an extraction race', async t => {
  const { sqlite, path } = fixture(t), db = openDatabase(path); t.after(() => db.close());
  const book = file(sqlite); let fail = true, calls = 0;
  const renderer = { info: async () => ({ pages: 3 }), text: async (_, page) => { calls++; if (page === 2 && fail) throw new Error('OCR unavailable'); return { text: 'Original păstrat', source: 'pdf' }; } };
  const service = createBookSearch(db, renderer);
  await service.search(book, 'original'); await service.idle();
  assert.equal((await service.search(book, 'original')).unavailable, 1);
  fail = false; await service.search(book, 'original', 0, true); await service.idle();
  assert.equal((await service.search(book, 'original')).unavailable, 0); assert.equal(calls, 4);
  const racing = file(sqlite); let release; const gate = new Promise(resolve => { release = resolve; });
  const slow = createBookSearch(db, { info: async () => ({ pages: 1 }), text: async () => { await gate; return { text: 'Text vechi', source: 'pdf' }; } });
  await slow.search(racing, 'corect');
  sqlite.prepare('INSERT INTO book_page_texts VALUES(?,?,?,?,?,?)').run(racing.id, 1, 'Text corect nou', 'ro', 1, 1);
  release(); await slow.idle();
  assert.equal((await slow.search(racing, 'corect')).total, 1);
  assert.equal((await slow.search(racing, 'vechi')).total, 0);
  for (const query of ['', 'a', 'x'.repeat(121), 'a\0b']) await assert.rejects(service.search(book, query), { status: 400 });
});

test('sitemap returns only paths and timestamps even for large poem bodies', async t => {
  const { sqlite, path } = fixture(t), db = openDatabase(path); t.after(() => db.close());
  const id = poem(sqlite, 'secret-tail'.repeat(3000));
  const entries = await sitemapEntries(db);
  assert.equal(entries.find(row => row.path === '/poeme/' + id).updated, 1);
  assert(entries.every(row => Object.keys(row).sort().join(',') === 'path,updated'));
  assert.equal(JSON.stringify(entries).includes('secret-tail'), false);
});
