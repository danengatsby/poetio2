import { openMediaValidator } from '../server/media-validator.mjs';
import { openAudioBucket, openVideoBucket } from '../server/vps-storage.mjs';
import { createHash } from 'node:crypto';
import { readyMediaValidator, mediaFixture } from './media-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import sharp from 'sharp';
import { imageDecoder } from '../server/image-decoder.mjs';
import { openBookRenderer } from '../server/book-renderer.mjs';
import { openBookBucket } from '../server/vps-storage.mjs';
import { bookFixture, finishedBookValidation } from './book-fixture.mjs';

const output = mkdtempSync(join(tmpdir(), 'stillword-tests-'));
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
for (const file of ['db/poem-admin-list', 'lib/poem-admin-list', 'lib/poem-search', 'lib/search-normalization', 'lib/search-fold-map', 'db/book-text-recovery', 'lib/book-text-recovery', 'db/media-validation', 'lib/translation-provenance', 'lib/site-language', 'db/poem-collection', 'lib/poem-collection', 'db/book-text', 'lib/book-text', 'db/book-validation', 'db/image-validation', 'db/editorial', 'lib/editorial', 'db/image-serving', 'db/comment-moderation', 'lib/comment-moderation', 'db/book-comments', 'db/books', 'db/book-files', 'lib/book-types', 'db/video-comments', 'db/videos', 'db/video-files', 'lib/video-types', 'db/about-comments', 'db/comments', 'lib/poem-comments', 'db/poems', 'db/audio', 'lib/poem-audio', 'db/seed-poems', 'db/images', 'db/language-backfill', 'lib/access', 'lib/poem-images', 'lib/poem-languages', 'lib/translate-poem']) {
  mkdirSync(join(output, file.split('/')[0]), { recursive: true });
  const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(output, file + '.js'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
}
process.on('exit', () => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { serveImage } = require(join(output, 'db/image-serving.js'));
const { saveImage } = require(join(output, 'db/images.js'));
const moderation = require(join(output, 'db/comment-moderation.js'));
const editorial = require(join(output, 'db/editorial.js'));
const service = require(join(output, 'db/poems.js'));
const { listAdminPoems } = require(join(output, 'db/poem-admin-list.js'));
const { listPoemCards } = require(join(output, 'db/poem-collection.js'));
const { collectionQuery, collectionHref, collectionReturnHref } = require(join(output, 'lib/poem-collection.js'));
const books = require(join(output, 'db/books.js'));
const bookFiles = require(join(output, 'db/book-files.js'));
const bookText = require(join(output, 'db/book-text.js'));
const textRecovery = require(join(output, 'db/book-text-recovery.js'));
// These database-only tests isolate persistence from the real renderer tested below.
const readyBookValidator = { async checkUpload() {}, async validation() { return { status: 'ready', pages: 2, checkedPages: 2 }; } };
const videos = require(join(output, 'db/videos.js'));
const videoFiles = require(join(output, 'db/video-files.js'));
const bookComments = require(join(output, 'db/book-comments.js'));
const videoComments = require(join(output, 'db/video-comments.js'));
const comments = require(join(output, 'db/comments.js'));
const aboutComments = require(join(output, 'db/about-comments.js'));
const access = require(join(output, 'lib/access.js'));
const { poemVersion } = require(join(output, 'lib/poem-languages.js'));
const { translationProvenance, translationStatus, parseTranslationProvenance } = require(join(output, 'lib/translation-provenance.js'));
const { translatePoem, parseTranslation } = require(join(output, 'lib/translate-poem.js'));
const { languageBackfill } = require(join(output, 'db/language-backfill.js'));
const sql = readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort().map(file => readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8')).join('\n');

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(sql);
  function prepare(query) {
    const statement = sqlite.prepare(query);
    let bindings = [];
    return {
      bind(...values) { bindings = values; return this; },
      async first() { return statement.get(...bindings) ?? null; },
      async all() { return { results: statement.all(...bindings) }; },
      async run() { return { meta: { changes: Number(statement.run(...bindings).changes) } }; },
    };
  }
  return { prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }, close() { sqlite.close(); } };
}
const id = '72766231-67aa-4db8-9123-77071144a730';
const input = { title: 'Întoarcere', author: 'Autor de test', theme: 'Amintiri', content: '  Întâiul vers\nAl doilea vers\n\nO nouă strofă — ș, ț, ă, î, â.\n' };

test('book text corrections preserve Unicode, detect stale edits, and override regenerated text', async () => {
  const db = database();
  const fileId = crypto.randomUUID();
  const renderer = { info: async () => ({ pages: 2 }), text: async () => ({ text: 'Automatic text', source: 'pdf' }) };
  try {
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(fileId, 'fixture', 'book.pdf', 'application/pdf', 50, 'hash', 'pensio53@gmail.com', 1).run();
    const file = await bookFiles.getBookFile(db, fileId);
    const automatic = await bookText.readBookText(db, file, 1, renderer);
    assert.equal(automatic.reviewed, false); assert.equal(automatic.revision, 0);
    const edit = { text: 'Întâiul vers\nAl doilea vers\n\nȘi o strofă nouă.', language: 'ro', revision: 0, reviewed: true };
    const first = await bookText.saveBookText(db, file, 1, edit, renderer);
    assert.equal(first.source, 'edited'); assert.equal(first.reviewed, true); assert.equal(first.revision, 1);
    assert.deepEqual(await bookText.readBookText(db, file, 1), first, 'Reviewed text does not depend on extractor availability');
    assert.deepEqual(await bookText.saveBookText(db, file, 1, edit, renderer), first, 'Retry after a lost response is safe');
    await assert.rejects(bookText.saveBookText(db, file, 1, { ...edit, text: 'Stale change' }, renderer), { status: 409 });
    const updated = await bookText.saveBookText(db, file, 1, { ...edit, text: '<script>text, not markup</script>\nVers corectat', revision: 1 }, renderer);
    assert.equal(updated.revision, 2); assert.match(updated.text, /<script>/, 'Rendering must escape text rather than interpreting HTML');
    assert.equal((await bookText.readBookText(db, file, 1, renderer, true)).revision, 2, 'An OCR proposal retains the current revision for safe correction');
    assert.deepEqual(await bookText.readBookText(db, file, 1), updated, 'OCR proposals never overwrite reviewed text');
    assert.equal((await bookText.readBookText(db, file, 2, undefined, false, true)).text, '', 'Manual transcription is available when OCR is down');
    for (const bad of [{ ...edit, reviewed: false }, { ...edit, text: '' }, { ...edit, text: 'x'.repeat(64001) }, { ...edit, language: 'bad' }, { ...edit, revision: -1 }]) await assert.rejects(bookText.saveBookText(db, file, 2, bad, renderer), { status: 400 });
    await assert.rejects(bookText.saveBookText(db, file, 3, edit, renderer), { status: 404 });
    await assert.rejects(bookText.saveBookText(db, { ...file, owner_email: 'other@example.test' }, 2, edit, renderer), { status: 404 });
    await assert.rejects(bookText.readBookText(db, file, 2), { status: 503 });
    assert.equal(bookText.textPageNumber('2000'), 2000);
    for (const value of ['0', '01', '1.5', '2001', '../1']) assert.throws(() => bookText.textPageNumber(value), { status: 404 });
  } finally { db.close(); }
});

test('transcription recovery isolates files and pages, preserves private drafts and records only committed versions', async () => {
  const db = database(), a = crypto.randomUUID(), b = crypto.randomUUID();
  const renderer = { info: async () => ({ pages: 2 }) };
  try {
    for (const id of [a,b]) await db.prepare('INSERT INTO book_files VALUES (?,?,?,?,?,?,?,?)').bind(id,id,'book.pdf','application/pdf',50,'hash','pensio53@gmail.com',1).run();
    const file = await bookFiles.getBookFile(db,a), other = await bookFiles.getBookFile(db,b);
    const snapshot = { fileId:a,page:1,text:'  Schiță\n\nȘ, ț — fără publicare. ',language:'ro',revision:0 }, id = crypto.randomUUID();
    await textRecovery.saveTextDraft(db,file,1,id,snapshot,renderer);
    await textRecovery.saveTextDraft(db,file,1,id,snapshot,renderer);
    assert.equal((await textRecovery.textRecoveryList(db,file,1,'drafts',0)).entries.length,1);
    assert.deepEqual((await textRecovery.textRecoveryItem(db,file,1,'drafts',id)).snapshot,snapshot);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM book_page_texts').first()).n,0);
    assert.equal((await db.prepare("SELECT COUNT(*) n FROM content_history WHERE kind='book-text'").first()).n,0);
    for (const [f,p] of [[file,2],[other,1]]) await assert.rejects(textRecovery.textRecoveryItem(db,f,p,'drafts',id),{status:404});
    await assert.rejects(textRecovery.saveTextDraft(db,file,1,id,{...snapshot,text:'Alt text'},renderer),{status:409});
    for (const bad of [{...snapshot,fileId:b},{...snapshot,page:2},{...snapshot,revision:-1},{...snapshot,text:'x'.repeat(64001)}]) await assert.rejects(textRecovery.saveTextDraft(db,file,1,crypto.randomUUID(),bad,renderer),{status:400});
    await assert.rejects(textRecovery.saveTextDraft(db,file,3,crypto.randomUUID(),{...snapshot,page:3},renderer),{status:404});
    await assert.rejects(textRecovery.textRecoveryList(db,{...file,owner_email:'other@example.test'},1,'history',0),{status:404});
    for (let index=0;index<21;index++) await textRecovery.saveTextDraft(db,file,1,crypto.randomUUID(),{...snapshot,text:String(index)},renderer);
    const first=await textRecovery.textRecoveryList(db,file,1,'drafts',0),second=await textRecovery.textRecoveryList(db,file,1,'drafts',20);
    assert.equal(first.entries.length,20);assert(first.hasMore);assert.equal(second.entries.length,2);assert(!second.hasMore);
    assert.equal(new Set([...first.entries,...second.entries].map(e=>e.id)).size,22);
    const one = {text:'Prima corectură',language:'ro',revision:0,reviewed:true};
    await bookText.saveBookText(db,file,1,one,renderer); await bookText.saveBookText(db,file,1,one,renderer);
    await bookText.saveBookText(db,file,1,{...one,text:'A doua corectură',revision:1},renderer);
    const history=await textRecovery.textRecoveryList(db,file,1,'history',0);
    assert.deepEqual(history.entries.map(e=>e.revision),[2,1]);
    const recovered=await textRecovery.textRecoveryItem(db,file,1,'history',String(history.entries[1].id));
    assert.equal(recovered.snapshot.text,one.text);
    assert.equal((await bookText.readBookText(db,file,1)).text,'A doua corectură','Reading history never republishes');
    await assert.rejects(bookText.saveBookText(db,file,1,{...one,text:'Stale'},renderer),{status:409});
    assert.equal((await textRecovery.textRecoveryList(db,file,1,'history',0)).entries.length,2);
    await db.prepare("CREATE TRIGGER deny_text_history BEFORE INSERT ON content_history WHEN NEW.kind='book-text' BEGIN SELECT RAISE(ABORT,'history unavailable'); END").run();
    await assert.rejects(bookText.saveBookText(db,file,1,{...one,text:'Must roll back',revision:2},renderer),/history unavailable/);
    assert.equal((await bookText.readBookText(db,file,1)).revision,2);
    await db.prepare('DROP TRIGGER deny_text_history').run();
    await db.prepare('DELETE FROM book_page_texts WHERE file_id=? AND page=1').bind(a).run();
    assert.equal((await textRecovery.textRecoveryList(db,file,1,'history',0)).entries[0].event,'deleted');
    await textRecovery.deleteTextDraft(db,other,1,id);
    assert.equal((await textRecovery.textRecoveryItem(db,file,1,'drafts',id)).snapshot.text,snapshot.text);
    await textRecovery.deleteTextDraft(db,file,1,id);
    await assert.rejects(textRecovery.textRecoveryItem(db,file,1,'drafts',id),{status:404});
  } finally { db.close(); }
});

function imageRequest(bytes, contentType, imageId = crypto.randomUUID()) {
  return new Request('https://example.test/api/images', { method: 'POST', body: bytes, headers: {
    'content-type': contentType, 'x-upload-id': imageId, 'oai-authenticated-user-email': 'pensio53@gmail.com',
  } });
}

async function imageFixture(format) {
  const raw = Buffer.from(Array.from({ length: 64 * 48 * 3 }, (_, i) => (i * 17 + i * i) % 256));
  return sharp(raw, { raw: { width: 64, height: 48, channels: 3 } }).toFormat(format).toBuffer();
}

test('image uploads fully decode JPEG, PNG and WebP while preserving originals and safe retries', async () => {
  const db = database();
  const objects = new Map();
  let writes = 0;
  const bucket = { async put(key, bytes) { writes++; objects.set(key, Buffer.from(bytes)); } };
  try {
    for (const format of ['jpeg', 'png', 'webp']) {
      const bytes = await imageFixture(format), imageId = crypto.randomUUID();
      const save = () => saveImage(db, bucket, imageRequest(bytes, `image/${format}`, imageId), imageDecoder);
      const saved = await save();
      assert.deepEqual(objects.get(saved.object_key), bytes);
      assert.equal(saved.content_type, `image/${format}`);
      assert.deepEqual(await save(), saved);
    }
    assert.equal(writes, 3);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_images').first()).n, 3);
  } finally { db.close(); }
});

test('forged headers, corrupt pixels and oversized dimensions leave image storage and metadata untouched', async () => {
  const db = database();
  let writes = 0;
  const bucket = { async put() { writes++; } };
  try {
    const forged = Buffer.alloc(24); forged.set([0xff, 0xd8, 0xff]);
    await assert.rejects(saveImage(db, bucket, imageRequest(forged, 'image/jpeg'), imageDecoder), { status: 415 });
    for (const format of ['jpeg', 'png', 'webp']) {
      const valid = await imageFixture(format);
      const truncated = valid.subarray(0, Math.floor(valid.length * 0.8));
      if (format !== 'webp') assert.equal((await imageDecoder.info(truncated)).width, 64, 'Headers alone still look valid');
      await assert.rejects(saveImage(db, bucket, imageRequest(truncated, `image/${format}`), imageDecoder), { status: 415 });
    }
    const large = await sharp({ create: { width: 8001, height: 5000, channels: 3, background: '#123456' } }).png().toBuffer();
    assert.ok(large.length < 5 * 1024 * 1024, 'Compressed bytes alone do not enforce the pixel limit');
    await assert.rejects(saveImage(db, bucket, imageRequest(large, 'image/png'), imageDecoder), { status: 413 });
    const valid = await imageFixture('png');
    await assert.rejects(saveImage(db, bucket, imageRequest(valid, 'image/jpeg'), imageDecoder), { status: 415 });
    await assert.rejects(saveImage(db, bucket, imageRequest(valid, 'image/png'), undefined), { status: 503 });
    assert.equal(writes, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_images').first()).n, 0);
  } finally { db.close(); }
});

test('image persistence waits for full decoding, even when valid metadata is already available', async () => {
  const db = database();
  let writes = 0, finishDecode, decoding;
  const started = new Promise(resolve => { decoding = resolve; });
  const decoder = {
    info: bytes => imageDecoder.info(bytes),
    decode() { decoding(); return new Promise(resolve => { finishDecode = resolve; }); },
  };
  try {
    const bytes = await imageFixture('png');
    const saved = saveImage(db, { async put() { writes++; } }, imageRequest(bytes, 'image/png'), decoder);
    await started;
    assert.equal(writes, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_images').first()).n, 0);
    finishDecode();
    await saved;
    assert.equal(writes, 1);
  } finally { db.close(); }
});

test('persistent collection supports create, retry, exact Romanian text, edit and delete', async () => {
  const db = database();
  try {
    assert.equal((await service.listPoems(db)).length, 6);
    const created = await service.createPoem(db, id, service.validateInput(input), readyMediaValidator);
    assert.equal(created.content, input.content);
    await service.createPoem(db, id, input, readyMediaValidator);
    assert.equal((await service.listPoems(db)).length, 7, 'Retry must not duplicate the poem');
    const updated = await service.updatePoem(db, id, 1, { ...input, title: 'Întoarcere, revizuit' }, readyMediaValidator);
    assert.equal(updated.revision, 2);
    assert.equal(updated.title, 'Întoarcere, revizuit');
    assert.equal((await service.getPoem(db, id)).content, input.content);
    await service.deletePoem(db, id, 2);
    assert.equal(await service.getPoem(db, id), null);
    await service.deletePoem(db, id, 2);
  } finally { db.close(); }
});

test('deleted original poems never reappear after every poem is removed', async () => {
  const db = database();
  try {
    for (const poem of await service.listPoems(db)) await service.deletePoem(db, poem.id, poem.revision);
    assert.deepEqual(await service.listPoems(db), []);
    assert.deepEqual(await service.listPoems(db), []);
  } finally { db.close(); }
});

test('stale edits and deletes cannot overwrite another saved revision', async () => {
  const db = database();
  try {
    await service.createPoem(db, id, input, readyMediaValidator);
    const edited = { ...input, title: 'Varianta nouă' };
    await service.updatePoem(db, id, 1, edited, readyMediaValidator);
    assert.equal((await service.updatePoem(db, id, 1, edited, readyMediaValidator)).revision, 2, 'Safe retry does not increment twice');
    await assert.rejects(service.updatePoem(db, id, 1, input, readyMediaValidator), { status: 409 });
    await assert.rejects(service.deletePoem(db, id, 1), { status: 409 });
    assert.equal((await service.getPoem(db, id)).title, 'Varianta nouă');
  } finally { db.close(); }
});

test('empty, oversized and malicious fields are handled without SQL interpolation', async () => {
  assert.throws(() => service.validateInput({ ...input, title: '  ' }), { status: 400 });
  assert.throws(() => service.validateInput({ ...input, content: 'x'.repeat(30001) }), { status: 400 });
  assert.throws(() => service.validateInput(null), { status: 400 });
  assert.throws(() => service.validateRevision(-1), { status: 400 });
  const db = database();
  try {
    const malicious = { ...input, title: "'); DROP TABLE poems; --", content: '<script>alert(1)</script>\nA second line' };
    const poem = await service.createPoem(db, id, service.validateInput(malicious), readyMediaValidator);
    assert.equal(poem.title, malicious.title);
    assert.equal((await service.listPoems(db)).length, 7);
  } finally { db.close(); }
});

test('private mutations require the owner, matching origin and JSON', () => {
  const url = 'https://stillword.example/api/poems';
  const headers = { 'oai-authenticated-user-email': 'pensio53@gmail.com', origin: 'https://stillword.example', 'content-type': 'application/json' };
  assert.doesNotThrow(() => access.requireSafeMutation(new Request(url, { method: 'POST', headers })));
  assert.throws(() => access.requireSafeMutation(new Request(url, { method: 'POST' })), { status: 401 });
  assert.throws(() => access.requireSafeMutation(new Request(url, { headers: { ...headers, 'oai-authenticated-user-email': 'visitor@example.com' } })), { status: 403 });
  assert.throws(() => access.requireSafeMutation(new Request(url, { headers: { ...headers, origin: 'https://another.example' } })), { status: 403 });
  assert.throws(() => access.requireSafeMutation(new Request(url, { headers: { ...headers, 'content-type': 'text/plain' } })), { status: 415 });
});

test('body parser preserves Unicode and rejects oversized streamed requests', async () => {
  const data = await access.readJson(new Request('https://example.test', { method: 'POST', body: JSON.stringify(input) }));
  assert.equal(data.content, input.content);
  await assert.rejects(access.readJson(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(320001) })), { status: 413 });
  await assert.rejects(access.readJson(new Request('https://example.test', { method: 'POST', body: '{broken' })), { status: 400 });
});

test('existing Romanian and American English poems receive matching versions without changing their originals', async () => {
  const db = database();
  try {
    await service.ensureInitialPoems(db);
    for (const prepared of languageBackfill.filter(row => !row.id.startsWith('original-'))) {
      await db.prepare('INSERT INTO poems (id, title, author, theme, content, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1, 1)').bind(prepared.id, prepared.expectedTitle, 'Autor neschimbat', prepared.expectedTheme, prepared.expectedContent).run();
    }
    const poems = await service.listPoems(db);
    for (const prepared of languageBackfill) {
      const poem = poems.find(item => item.id === prepared.id);
      assert.equal(poem.title, prepared.expectedTitle);
      assert.equal(poem.content, prepared.expectedContent);
      const original = poemVersion(poem, prepared.sourceLanguage);
      const translation = poemVersion(poem, prepared.sourceLanguage === 'ro' ? 'en-US' : 'ro');
      assert.equal(original.content, prepared.expectedContent);
      assert.equal(translation.title, prepared.title);
      assert.equal(translation.content, prepared.content);
      assert.equal(translation.content.split('\n').length, original.content.split('\n').length);
    }
    const romanian = poems.find(poem => poem.id === 'a7407c3a-e853-4515-85be-a3089217aa3c');
    assert.equal(romanian.author, 'Autor neschimbat');
    assert.equal(poemVersion(romanian, 'en-US').title, 'The Wheel of Smoke and Stars');
    const english = poems.find(poem => poem.id === 'original-3');
    assert.equal(poemVersion(english, 'ro').title, 'O marți obișnuită');
    await service.updatePoem(db, english.id, english.revision, { title: english.title, author: english.author, theme: english.theme, content: english.content, translated_title: null, translated_theme: null, translated_content: null }, readyMediaValidator);
    assert.equal(poemVersion((await service.listPoems(db)).find(poem => poem.id === english.id), 'ro'), null, 'A removed translation is not silently recreated');
  } finally { db.close(); }
});

test('translation backfill skips source text edited after the reviewed snapshot', async () => {
  const db = database();
  try {
    await service.ensureInitialPoems(db);
    await db.prepare('UPDATE poems SET content = ? WHERE id = ?').bind('A newly edited poem.', 'original-3').run();
    const poems = await service.listPoems(db);
    const changed = poems.find(poem => poem.id === 'original-3');
    assert.equal(changed.content, 'A newly edited poem.');
    assert.equal(changed.translated_content, null);
    assert.equal(changed.source_language, 'en-US');
  } finally { db.close(); }
});

test('bilingual saves validate both versions and distinguish missing translations from originals', async () => {
  const db = database();
  const bilingual = { ...input, source_language: 'ro', translated_title: 'Return', translated_theme: 'Memories', translated_content: '  First line\nSecond line\n\nAnother stanza.\n' };
  bilingual.translation_provenance = await translationProvenance(bilingual, 'manual');
  try {
    const poem = await service.createPoem(db, id, service.validateInput(bilingual), readyMediaValidator);
    assert.equal(poemVersion(poem, 'ro').content, input.content);
    assert.equal(poemVersion(poem, 'en-US').content, bilingual.translated_content);
    const authorOnly = await service.updatePoem(db, id, 1, { ...input, author: 'Autor editat' }, readyMediaValidator);
    assert.equal(authorOnly.translated_content, bilingual.translated_content, 'Older forms preserve translations when only shared metadata changes');
    const changedSource = await service.updatePoem(db, id, 2, { ...input, content: 'Un poem nou.' }, readyMediaValidator);
    assert.equal(changedSource.translated_content, null, 'An older form cannot leave a translation attached to changed source text');
    assert.equal(poemVersion(changedSource, 'en-US'), null);
    assert.throws(() => service.validateInput({ ...bilingual, source_language: 'fr' }), { status: 400 });
    assert.throws(() => service.validateInput({ ...bilingual, translated_content: '' }), { status: 400 });
    assert.throws(() => service.validateInput({ ...bilingual, translated_content: 'x'.repeat(30001) }), { status: 400 });
  } finally { db.close(); }
});

test('OpenAI translation preserves indentation and blank lines and saves both variants together', async () => {
  const original = { title: 'Lumină', theme: '', content: '  Lumina cade\n\nPeste oraș.\n' };
  const providerResult = { title: 'Light', theme: '', lines: ['The light falls', '', 'Over the city.', ''] };
  let calls = 0;
  const generated = await translatePoem(original, { OPENAI_API_KEY: 'test-key' }, async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const request = JSON.parse(options.body);
    assert.equal(request.store, false);
    assert.match(request.instructions, /American English/);
    assert.equal(request.text.format.strict, true);
    assert.deepEqual(JSON.parse(request.input).lines, original.content.split('\n'));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(providerResult) }] }] });
  });
  assert.equal(calls, 1);
  assert.equal(generated.translated_content, '  The light falls\n\nOver the city.\n');
  const db = database();
  try {
    const savedInput = service.validateInput({ ...original, author: 'Autor', source_language: 'ro', ...generated });
    const saved = await service.createPoem(db, id, savedInput, readyMediaValidator);
    assert.equal(saved.content, original.content);
    assert.equal(poemVersion(saved, 'en-US').content, generated.translated_content);
    assert.equal((await service.createPoem(db, id, savedInput, readyMediaValidator)).revision, 1);
  } finally { db.close(); }
});

test('missing credentials, upstream failures and refused or incomplete translations are recoverable', async () => {
  let calls = 0;
  await assert.rejects(translatePoem(input, {}, async () => { calls++; }), { status: 503 });
  assert.equal(calls, 0);
  const config = { OPENAI_API_KEY: 'test-key' };
  for (const status of [401, 429, 500]) {
    await assert.rejects(translatePoem(input, config, async () => Response.json({ error: 'provider details must not leak' }, { status })), error => error.status === 503 && !error.message.includes('provider details'));
  }
  await assert.rejects(translatePoem(input, config, async () => { throw new TypeError('network failed with secret details'); }), { status: 503 });
  for (const payload of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{broken' }] }] },
  ]) await assert.rejects(translatePoem(input, config, async () => Response.json(payload)), { status: 503 });
});

test('translations with missing, extra, blank or merged verses are rejected', () => {
  const original = { title: 'Noapte', theme: '', content: 'Primul vers\n\nUltimul vers' };
  const valid = { title: 'Night', theme: '', lines: ['First line', '', 'Last line'] };
  for (const changed of [
    { ...valid, lines: ['First line', 'Last line'] },
    { ...valid, lines: ['First line', 'Invented line', 'Last line'] },
    { ...valid, lines: ['First\nline', '', 'Last line'] },
    { ...valid, lines: ['First line', '', ''] },
    { ...valid, lines: ['x'.repeat(30001), '', 'Last line'] },
    { ...valid, title: '' },
  ]) assert.throws(() => parseTranslation(changed, original), { status: 503 });
});

const audio = require(join(output, 'db/audio.js'));
const { wavFixture } = await import('./audio-fixture.mjs');

test('audio rejects disguised or oversized uploads and supports common container signatures', async () => {
  const bytes = wavFixture();
  const req = (body, type = 'audio/wav', extra = {}) => new Request('https://poetio.test/api/audio', { method: 'POST', headers: { 'Content-Type': type, ...extra }, body, duplex: 'half' });
  assert.equal((await audio.readAudioBytes(req(bytes))).contentType, 'audio/wav');
  assert.equal((await audio.readAudioBytes(req(bytes, 'audio/x-wav'))).contentType, 'audio/wav');
  await assert.rejects(audio.readAudioBytes(req('<script>bad</script>')), { status: 415 });
  await assert.rejects(audio.readAudioBytes(req(bytes, 'audio/mpeg')), { status: 415 });
  await assert.rejects(audio.readAudioBytes(req(bytes, 'audio/wav', { 'Content-Length': String(25 * 1024 * 1024 + 1) })), { status: 413 });
  let cancelled = false;
  const oversized = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  await assert.rejects(audio.readAudioBytes(req(oversized)), { status: 413 });
  assert.equal(cancelled, true);
  assert.equal(audio.audioType(Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 0, 0])), 'audio/mpeg');
  const m4a = Buffer.alloc(40); m4a.writeUInt32BE(24); m4a.write('ftypM4A ', 4);
  assert.equal(audio.audioType(m4a), 'audio/mp4');
  const ogg = Buffer.alloc(50); ogg.write('OggS'); ogg[26] = 1; ogg[27] = 19; ogg.write('OpusHead', 28);
  assert.equal(audio.audioType(ogg), 'audio/ogg');
  assert.throws(() => audio.audioType(new Uint8Array()), { status: 415 });
});

test('recordings remain private until attached, support seeking, and detach without changing text', async () => {
  const db = database();
  const objects = new Map();
  const bucket = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key, options) {
      const bytes = objects.get(key); if (!bytes) return null;
      const range = options?.range;
      return { size: bytes.length, body: new Response(range ? bytes.slice(range.offset, range.offset + range.length) : bytes).body };
    },
  };
  const recordingId = 'ff66365b-550d-4e6b-81ce-c79a218a8ee5';
  const secondId = '9a1c843c-31e1-408b-953d-e2cfc75c1279';
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const bytes = wavFixture();
  const upload = (uploadId, body = bytes) => new Request('https://poetio.test/api/audio', { method: 'POST', headers: { ...owner, 'Content-Type': 'audio/wav', 'X-Upload-Id': uploadId, 'X-File-Name': encodeURIComponent('Vocea mea.wav') }, body });
  const read = (audioId = recordingId, headers = {}, method = 'GET') => audio.serveAudio(db, bucket, new Request('https://poetio.test/api/audio/' + audioId, { headers, method }), audioId);
  try {
    const saved = await audio.saveAudio(db, bucket, upload(recordingId), readyMediaValidator);
    assert.equal(saved.file_name, 'Vocea mea.wav');
    assert.equal((await audio.saveAudio(db, bucket, upload(recordingId), readyMediaValidator)).id, recordingId);
    await assert.rejects(audio.saveAudio(db, bucket, upload(recordingId, wavFixture(4000)), readyMediaValidator), { status: 409 });
    assert.equal(objects.size, 1);
    assert.equal((await read()).status, 404);
    const privateFile = await read(recordingId, owner);
    assert.equal(privateFile.status, 200); await privateFile.body.cancel();
    await assert.rejects(service.createPoem(db, id, { ...input, audio_ro_id: secondId }, readyMediaValidator), { status: 400 });
    assert.throws(() => service.validateInput({ ...input, audio_ro_id: '../../bad' }), { status: 400 });
    const poemInput = { ...input, audio_ro_id: recordingId };
    const poem = await service.createPoem(db, id, poemInput, readyMediaValidator);
    assert.equal(poem.audio_ro_id, recordingId);
    assert.equal(poem.audio_en_id, null);
    assert.equal((await service.createPoem(db, id, poemInput, readyMediaValidator)).revision, 1);
    await assert.rejects(service.createPoem(db, id, input, readyMediaValidator), { status: 409 });
    const head = await read(recordingId, { Range: 'bytes=44-99' }, 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.headers.get('Content-Length'), String(bytes.length)); assert.equal(head.body, null);
    for (const [header, start, end] of [['bytes=44-99', 44, 99], ['bytes=100-', 100, bytes.length - 1], ['bytes=-64', bytes.length - 64, bytes.length - 1], ['bytes=0-999999', 0, bytes.length - 1]]) {
      const response = await read(recordingId, { Range: header });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    }
    for (const range of ['bytes=999999-', 'bytes=20-10', 'bytes=-0']) {
      const response = await read(recordingId, { Range: range });
      assert.equal(response.status, 416); assert.equal(response.headers.get('Content-Range'), `bytes */${bytes.length}`);
    }
    const staleRange = await read(recordingId, { Range: 'bytes=44-99', 'If-Range': '"old-file"' });
    assert.equal(staleRange.status, 200); await staleRange.body.cancel();
    await audio.saveAudio(db, bucket, upload(secondId), readyMediaValidator);
    const replaced = await service.updatePoem(db, id, 1, { ...input, audio_ro_id: secondId, audio_en_id: recordingId }, readyMediaValidator);
    assert.equal(replaced.audio_ro_id, secondId); assert.equal(replaced.audio_en_id, recordingId);
    await assert.rejects(service.updatePoem(db, id, 1, poemInput, readyMediaValidator), { status: 409 });
    const olderForm = await service.updatePoem(db, id, 2, { ...input, author: 'Autor revizuit', source_language: 'en-US' }, readyMediaValidator);
    assert.equal(olderForm.audio_ro_id, secondId); assert.equal(olderForm.audio_en_id, recordingId, 'Language-specific audio cannot swap when source language changes');
    const detached = await service.updatePoem(db, id, 3, { ...input, audio_ro_id: null, audio_en_id: null }, readyMediaValidator);
    assert.equal(detached.content, input.content);
    assert.equal((await read()).status, 404); assert.equal((await read(secondId)).status, 404);
    assert.equal(objects.size, 2, 'Detached files remain recoverable in private storage');
  } finally { db.close(); }
});


test('public comments validate input, preserve text, paginate, retry safely and follow poem deletion', async () => {
  const db = database();
  const input = { id: crypto.randomUUID(), name: '  Cititor  ', content: "  O emoție.\r\n\r\n<script>alert('x')</script>  " };
  try {
    await service.listPoems(db);
    const comment = await comments.createComment(db, 'original-1', input);
    assert.equal(comment.name, 'Cititor');
    assert.equal(comment.content, "O emoție.\n\n<script>alert('x')</script>");
    assert.deepEqual(await comments.createComment(db, 'original-1', input), comment);
    await assert.rejects(comments.createComment(db, 'original-2', input), { status: 409 });
    await assert.rejects(comments.createComment(db, 'original-1', { ...input, content: 'changed' }), { status: 409 });
    assert.equal((await comments.listComments(db, 'original-1')).comments.length, 0);
    await moderation.moderateComment(db, 'poem', input.id, 1, 'approved');
    assert.equal((await comments.listComments(db, 'original-1')).comments.length, 1);
    assert.equal((await comments.listComments(db, 'original-2')).comments.length, 0);
    const counts = Object.fromEntries((await service.listPoems(db)).map(poem => [poem.id, poem.comment_count]));
    assert.equal(counts['original-1'], 1, 'Retries must not inflate the comment count');
    assert.equal(counts['original-2'], 0);
    assert.equal((await comments.listComments(db, 'original-2')).total, 0);
    for (let i = 0; i < 21; i++) {
      const extraId = crypto.randomUUID();
      await comments.createComment(db, 'original-1', { ...input, id: extraId, content: `Comment ${i}` });
      await moderation.moderateComment(db, 'poem', extraId, 1, 'approved');
    }
    const first = await comments.listComments(db, 'original-1');
    const second = await comments.listComments(db, 'original-1', 20);
    assert.equal(first.comments.length, 20);
    assert.equal(first.total, 22);
    assert.equal(second.total, 22, 'Count is the full total, independent of pagination');
    assert.equal((await service.listPoems(db)).find(poem => poem.id === 'original-1').comment_count, 22);
    assert.equal(first.hasMore, true);
    assert.equal(second.comments.length, 2);
    assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.comments, ...second.comments].map(row => row.id)).size, 22);
    await assert.rejects(comments.listComments(db, 'original-1', -1), { status: 400 });
    const poem = await service.getPoem(db, 'original-1');
    await service.deletePoem(db, poem.id, poem.revision);
    assert.equal((await db.prepare('SELECT * FROM poem_comments').all()).results.length, 0);
    await assert.rejects(comments.createComment(db, 'original-1', { ...input, id: crypto.randomUUID() }), { status: 404 });
    await assert.rejects(comments.listComments(db, 'original-1'), { status: 404 });
  } finally { db.close(); }
  for (const value of [null, [], {}, { ...input, name: ' ' }, { ...input, content: ' ' }, { ...input, name: 'x'.repeat(81) }, { ...input, content: 'x'.repeat(2001) }, { ...input, id: 'original-1' }]) assert.throws(() => comments.validateComment(value), { status: 400 });
});

test('public comment origin checks need no login and reject cross-site submissions', async () => {
  const request = headers => new Request('https://poetio.test/api/poems/original-1/comments', { method: 'POST', headers });
  assert.doesNotThrow(() => access.requireSameOrigin(request({ Origin: 'https://poetio.test' })));
  for (const headers of [{}, { Origin: 'https://other.test' }, { Origin: 'https://poetio.test', 'Sec-Fetch-Site': 'cross-site' }]) assert.throws(() => access.requireSameOrigin(request(headers)), { status: 403 });
  await assert.rejects(access.readJson(new Request('https://poetio.test', { method: 'POST', body: 'x'.repeat(16385) }), 16384), { status: 413 });
});


test('About Poetio comments persist independently of poems, validate, paginate and retry safely', async () => {
  const db = database();
  const input = { id: crypto.randomUUID(), name: ' Cititor ', content: ' Frumoasă poveste!\r\nMulțumesc. ' };
  try {
    const first = await aboutComments.createAboutComment(db, input);
    assert.equal(first.name, 'Cititor');
    assert.equal(first.content, 'Frumoasă poveste!\nMulțumesc.');
    assert.deepEqual(await aboutComments.createAboutComment(db, input), first);
    await assert.rejects(aboutComments.createAboutComment(db, { ...input, content: 'Changed' }), { status: 409 });
    for (const value of [null, {}, { ...input, name: ' ' }, { ...input, content: 'x'.repeat(2001) }]) await assert.rejects(aboutComments.createAboutComment(db, value), { status: 400 });
    await service.listPoems(db);
    assert.equal((await comments.listComments(db, 'original-1')).comments.length, 0);
    await comments.createComment(db, 'original-1', { ...input, id: crypto.randomUUID(), content: 'Only on the poem' });
    assert.equal((await aboutComments.listAboutComments(db)).comments.length, 0);
    await moderation.moderateComment(db, 'about', input.id, 1, 'approved');
    assert.equal((await aboutComments.listAboutComments(db)).comments.length, 1);
    for (const poem of await service.listPoems(db)) await service.deletePoem(db, poem.id, poem.revision);
    assert.deepEqual((await aboutComments.listAboutComments(db)).comments, [first]);
    for (let i = 0; i < 20; i++) {
      const extraId = crypto.randomUUID();
      await aboutComments.createAboutComment(db, { ...input, id: extraId, content: `About ${i}` });
      await moderation.moderateComment(db, 'about', extraId, 1, 'approved');
    }
    const page1 = await aboutComments.listAboutComments(db);
    const page2 = await aboutComments.listAboutComments(db, 20);
    assert.equal(page1.comments.length, 20); assert.equal(page1.hasMore, true);
    assert.equal(page2.comments.length, 1); assert.equal(page2.hasMore, false);
    assert.equal(new Set([...page1.comments, ...page2.comments].map(row => row.id)).size, 21);
    for (const offset of [-1, NaN, 0.5]) await assert.rejects(aboutComments.listAboutComments(db, offset), { status: 400 });
  } finally { db.close(); }
});


test('video upload, publication, byte ranges, revision conflicts and removal keep files private until attached', async () => {
  const db = database();
  const objects = new Map();
  const bucket = {
    async put(key, bytes) { objects.set(key, bytes); },
    async get(key, options) {
      const bytes = objects.get(key); if (!bytes) return null;
      const range = options?.range;
      return { size: bytes.length, body: new Response(range ? bytes.slice(range.offset, range.offset + range.length) : bytes).body };
    },
  };
  const bytes = new Uint8Array(256);
  bytes.set([0, 0, 0, 32]); bytes.set(new TextEncoder().encode('ftypisom'), 4);
  const fileId = crypto.randomUUID(); const secondId = crypto.randomUUID(); const videoId = crypto.randomUUID();
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const upload = (id = fileId, data = bytes) => new Request('https://poetio.test/api/video-files', { method: 'POST', headers: { ...owner, Origin: 'https://poetio.test', 'Content-Type': 'video/mp4', 'X-Upload-Id': id, 'X-File-Name': encodeURIComponent('film.mp4') }, body: data });
  const read = (id = fileId, headers = {}, method = 'GET') => videoFiles.serveVideoFile(db, bucket, new Request('https://poetio.test/api/video-files/' + id, { method, headers }), id);
  const input = { title: ' Poveste ', author: ' Autor ', description: 'Prima scenă\r\nA doua.', file_id: fileId };
  try {
    assert.deepEqual(await videos.listVideos(db), []);
    const uploaded = await videoFiles.saveVideoFile(db, bucket, upload(), readyMediaValidator);
    assert.equal(uploaded.content_type, 'video/mp4');
    assert.equal((await videoFiles.saveVideoFile(db, bucket, upload(), readyMediaValidator)).id, fileId);
    assert.equal((await read()).status, 404);
    const privateRead = await read(fileId, owner); assert.equal(privateRead.status, 200); await privateRead.body.cancel();
    const changedBytes = bytes.slice(); changedBytes[100] = 1;
    await assert.rejects(videoFiles.saveVideoFile(db, bucket, upload(fileId, changedBytes), readyMediaValidator), { status: 409 });
    const created = await videos.createVideo(db, videoId, input, readyMediaValidator);
    assert.equal(created.title, 'Poveste'); assert.equal(created.description, 'Prima scenă\nA doua.');
    assert.equal((await videos.createVideo(db, videoId, input, readyMediaValidator)).revision, 1);
    await assert.rejects(videos.createVideo(db, videoId, { ...input, title: 'Changed' }, readyMediaValidator), { status: 409 });
    const head = await read(fileId, { Range: 'bytes=4-15' }, 'HEAD'); assert.equal(head.status, 200); assert.equal(head.headers.get('Content-Length'), '256'); assert.equal(head.body, null);
    for (const [range, start, end] of [['bytes=4-15', 4, 15], ['bytes=200-', 200, 255], ['bytes=-10', 246, 255]]) {
      const response = await read(fileId, { Range: range }); assert.equal(response.status, 206);
      assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/256`);
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
    }
    assert.equal((await read(fileId, { Range: 'bytes=900-' })).status, 416);
    const full = await read(fileId, { Range: 'bytes=4-15', 'If-Range': '"old"' }); assert.equal(full.status, 200); await full.body.cancel();
    const edited = await videos.updateVideo(db, videoId, 1, { ...input, title: 'Revizuit' }, readyMediaValidator); assert.equal(edited.revision, 2);
    assert.equal((await videos.updateVideo(db, videoId, 1, { ...input, title: 'Revizuit' }, readyMediaValidator)).revision, 2);
    await assert.rejects(videos.updateVideo(db, videoId, 1, input, readyMediaValidator), { status: 409 });
    await assert.rejects(videos.deleteVideo(db, videoId, 1), { status: 409 });
    await videoFiles.saveVideoFile(db, bucket, upload(secondId), readyMediaValidator);
    await videos.updateVideo(db, videoId, 2, { ...input, file_id: secondId }, readyMediaValidator);
    assert.equal((await read()).status, 404);
    await videos.deleteVideo(db, videoId, 3); await videos.deleteVideo(db, videoId, 3);
    assert.deepEqual(await videos.listVideos(db), []); assert.equal((await read(secondId)).status, 404);
    assert.equal(objects.size, 2, 'Detached files remain privately recoverable');
    await assert.rejects(videos.updateVideo(db, videoId, 3, input, readyMediaValidator), { status: 404 });
    await assert.rejects(videos.createVideo(db, videoId, { ...input, file_id: crypto.randomUUID() }, readyMediaValidator), { status: 400 });
    for (const bad of [null, {}, { ...input, title: ' ' }, { ...input, file_id: '../invalid' }, { ...input, description: 'x'.repeat(5001) }]) assert.throws(() => videos.validateVideo(bad), { status: 400 });
  } finally { db.close(); }
});

test('video containers, content type and size limits are enforced for streamed uploads', async () => {
  assert.throws(() => videoFiles.videoType(new TextEncoder().encode('<html>not a video</html>')), { status: 415 });
  const webm = new Uint8Array(64); webm.set([0x1a, 0x45, 0xdf, 0xa3]); webm.set(new TextEncoder().encode('webm'), 20);
  assert.equal(videoFiles.videoType(webm), 'video/webm');
  const request = (body, headers = {}) => new Request('https://poetio.test/api/video-files', { method: 'POST', headers: { 'Content-Type': 'video/webm', ...headers }, body });
  assert.equal((await videoFiles.readVideoBytes(request(webm))).contentType, 'video/webm');
  await assert.rejects(videoFiles.readVideoBytes(request(webm, { 'Content-Type': 'video/mp4' })), { status: 415 });
  await assert.rejects(videoFiles.readVideoBytes(request(webm, { 'Content-Length': String(100 * 1024 * 1024 + 1) })), { status: 413 });
  let chunks = 0; let cancelled = false;
  const block = new Uint8Array(1024 * 1024);
  const stream = new ReadableStream({ pull(controller) { if (chunks++ < 101) controller.enqueue(block); else controller.close(); }, cancel() { cancelled = true; } });
  await assert.rejects(videoFiles.readVideoBytes(new Request('https://poetio.test', { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: stream, duplex: 'half' })), { status: 413 });
  assert.equal(cancelled, true);
});


test('video comments are isolated, counted across pages, idempotent and removed with their video', async () => {
  const db = database();
  const firstId = crypto.randomUUID(), secondId = crypto.randomUUID(), fileId = crypto.randomUUID();
  const input = { id: crypto.randomUUID(), name: 'Cititor', content: 'O emoție.\n<script>text</script>' };
  try {
    await db.prepare('INSERT INTO video_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(fileId, 'fixture', 'film.mp4', 'video/mp4', 1, 'hash', 'pensio53@gmail.com', 1).run();
    for (const id of [firstId, secondId]) await videos.createVideo(db, id, { title: 'Video', author: '', description: '', file_id: fileId }, readyMediaValidator);
    assert.equal((await videoComments.listVideoComments(db, firstId)).total, 0);
    const saved = await videoComments.createVideoComment(db, firstId, input);
    assert.equal(saved.content, input.content);
    assert.deepEqual(await videoComments.createVideoComment(db, firstId, input), saved);
    await assert.rejects(videoComments.createVideoComment(db, secondId, input), { status: 409 });
    await assert.rejects(videoComments.createVideoComment(db, firstId, { ...input, content: 'Changed' }), { status: 409 });
    assert.equal((await videoComments.listVideoComments(db, firstId)).total, 0);
    await moderation.moderateComment(db, 'video', input.id, 1, 'approved');
    assert.equal((await videoComments.listVideoComments(db, firstId)).total, 1);
    const counts = Object.fromEntries((await videos.listVideos(db)).map(video => [video.id, video.comment_count]));
    assert.equal(counts[firstId], 1, 'Retries must not inflate the card count');
    assert.equal(counts[secondId], 0);
    assert.equal((await videoComments.listVideoComments(db, secondId)).total, 0);
    for (let i = 0; i < 20; i++) {
      const extraId = crypto.randomUUID();
      await videoComments.createVideoComment(db, firstId, { ...input, id: extraId });
      await moderation.moderateComment(db, 'video', extraId, 1, 'approved');
    }
    const first = await videoComments.listVideoComments(db, firstId);
    const second = await videoComments.listVideoComments(db, firstId, 20);
    assert.equal(first.total, 21); assert.equal(second.total, 21);
    assert.equal((await videos.listVideos(db)).find(video => video.id === firstId).comment_count, 21, 'Card counts include every page');
    assert.equal(first.comments.length, 20); assert.equal(first.hasMore, true);
    assert.equal(second.comments.length, 1); assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.comments, ...second.comments].map(comment => comment.id)).size, 21);
    for (const offset of [-1, 0.5, NaN]) await assert.rejects(videoComments.listVideoComments(db, firstId, offset), { status: 400 });
    await assert.rejects(videoComments.createVideoComment(db, firstId, { ...input, content: ' ' }), { status: 400 });
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM poem_comments').first()).total, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM about_comments').first()).total, 0);
    await videos.deleteVideo(db, firstId, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM video_comments').first()).total, 0);
    await assert.rejects(videoComments.listVideoComments(db, firstId), { status: 404 });
    await assert.rejects(videoComments.createVideoComment(db, firstId, input), { status: 404 });
  } finally { db.close(); }
});


test('books keep original PDFs private after publication and enforce upload and revision rules', async () => {
  const db = database(), objects = new Map();
  const bucket = { async put(key, bytes) { objects.set(key, bytes); }, async get(key, options) {
    const bytes = objects.get(key); if (!bytes) return null;
    const range = options?.range;
    return { size: bytes.length, body: new Response(range ? bytes.slice(range.offset, range.offset + range.length) : bytes).body };
  } };
  const id = crypto.randomUUID(), fileId = crypto.randomUUID(), imageId = crypto.randomUUID();
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const bytes = new TextEncoder().encode('%PDF-1.7\nPDF fixture\n%%EOF');
  const upload = () => new Request('https://poetio.test/api/book-files', { method: 'POST', headers: { ...owner, 'Content-Type': 'application/pdf', 'X-Upload-Id': fileId, 'X-File-Name': encodeURIComponent('Carte română.pdf') }, body: bytes });
  const read = (headers = {}, method = 'GET', query = '') => bookFiles.serveBookFile(db, bucket, new Request('https://poetio.test/api/book-files/' + fileId + query, { headers, method }), fileId);
  const input = { title: 'Cartea mea', author: 'Autor', description: 'Descriere\nCu două rânduri', file_id: fileId, image_id: imageId };
  try {
    assert.deepEqual(await books.listBooks(db), []);
    await bookFiles.saveBookFile(db, bucket, upload(), readyBookValidator);
    assert.equal((await bookFiles.saveBookFile(db, bucket, upload(), readyBookValidator)).id, fileId);
    assert.equal((await read()).status, 404);
    const preview = await read(owner); assert.equal(preview.status, 200); await preview.body.cancel();
    await assert.rejects(books.createBook(db, id, input, readyBookValidator), { status: 400 });
    await db.prepare('INSERT INTO poem_images VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(imageId, 'fixture', 'cover.png', 'image/png', 1, 'hash', 'pensio53@gmail.com', 1).run();
    const book = await books.createBook(db, id, input, readyBookValidator);
    assert.equal(book.image_id, imageId); assert.equal(book.description, input.description);
    assert.deepEqual(await books.createBook(db, id, input, readyBookValidator), book);
    assert.equal((await books.listBooks(db)).length, 1);
    await assert.rejects(books.createBook(db, id, { ...input, title: 'Conflict' }, readyBookValidator), { status: 409 });
    assert.equal((await read()).status, 404, 'Published originals must never be available to guests');
    assert.equal((await read({}, 'HEAD', '?download=1')).status, 404);
    const pdf = await read(owner); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.match(pdf.headers.get('content-disposition'), /^inline;/); assert.deepEqual(new Uint8Array(await pdf.arrayBuffer()), bytes);
    const partial = await read({ ...owner, Range: 'bytes=0-7' }); assert.equal(partial.status, 206); assert.equal(await partial.text(), '%PDF-1.7');
    assert.equal((await read({ ...owner, Range: 'bytes=1000-' })).status, 416);
    const head = await read(owner, 'HEAD', '?download=1'); assert.match(head.headers.get('content-disposition'), /^attachment;/); assert.equal(await head.text(), '');
    const edited = { ...input, title: 'Revizuită', image_id: null };
    assert.equal((await books.updateBook(db, id, 1, edited, readyBookValidator)).revision, 2);
    assert.equal((await books.updateBook(db, id, 1, edited, readyBookValidator)).revision, 2);
    await assert.rejects(books.updateBook(db, id, 1, input, readyBookValidator), { status: 409 });
    await assert.rejects(books.deleteBook(db, id, 1), { status: 409 });
    await books.deleteBook(db, id, 2); await books.deleteBook(db, id, 2);
    assert.equal((await read()).status, 404); assert.equal(objects.size, 1);
    for (const value of [null, {}, { ...input, title: ' ' }, { ...input, image_id: '../invalid' }]) assert.throws(() => books.validateBook(value), { status: 400 });
    assert.throws(() => bookFiles.bookType(new TextEncoder().encode('<html>not PDF</html>')), { status: 415 });
    await assert.rejects(bookFiles.readBookBytes(new Request('https://poetio.test', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(100 * 1024 * 1024 + 1) }, body: bytes })), { status: 413 });
    await assert.rejects(bookFiles.readBookBytes(new Request('https://poetio.test', { method: 'POST', headers: { 'Content-Type': 'text/html' }, body: bytes })), { status: 415 });
  } finally { db.close(); }
});

test('book comments are isolated, counted across pages, idempotent and removed with their book', async () => {
  const db = database();
  const firstId = crypto.randomUUID(), secondId = crypto.randomUUID(), fileId = crypto.randomUUID();
  const input = { id: crypto.randomUUID(), name: 'Cititor', content: 'O emoție.\n<script>text</script>' };
  try {
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(fileId, 'fixture', 'carte.pdf', 'application/pdf', 1, 'hash', 'pensio53@gmail.com', 1).run();
    for (const id of [firstId, secondId]) await books.createBook(db, id, { title: 'Book', author: '', description: '', file_id: fileId }, readyBookValidator);
    assert.equal((await bookComments.listBookComments(db, firstId)).total, 0);
    const saved = await bookComments.createBookComment(db, firstId, input);
    assert.equal(saved.content, input.content);
    assert.deepEqual(await bookComments.createBookComment(db, firstId, input), saved);
    await assert.rejects(bookComments.createBookComment(db, secondId, input), { status: 409 });
    await assert.rejects(bookComments.createBookComment(db, firstId, { ...input, content: 'Changed' }), { status: 409 });
    assert.equal((await bookComments.listBookComments(db, firstId)).total, 0);
    await moderation.moderateComment(db, 'book', input.id, 1, 'approved');
    assert.equal((await bookComments.listBookComments(db, firstId)).total, 1);
    const counts = Object.fromEntries((await books.listBooks(db)).map(book => [book.id, book.comment_count]));
    assert.equal(counts[firstId], 1, 'Retries must not inflate the card count');
    assert.equal(counts[secondId], 0);
    assert.equal((await bookComments.listBookComments(db, secondId)).total, 0);
    for (let i = 0; i < 20; i++) {
      const extraId = crypto.randomUUID();
      await bookComments.createBookComment(db, firstId, { ...input, id: extraId });
      await moderation.moderateComment(db, 'book', extraId, 1, 'approved');
    }
    const first = await bookComments.listBookComments(db, firstId);
    const second = await bookComments.listBookComments(db, firstId, 20);
    assert.equal(first.total, 21); assert.equal(second.total, 21);
    assert.equal((await books.listBooks(db)).find(book => book.id === firstId).comment_count, 21, 'Card counts include every page');
    assert.equal(first.comments.length, 20); assert.equal(first.hasMore, true);
    assert.equal(second.comments.length, 1); assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.comments, ...second.comments].map(comment => comment.id)).size, 21);
    for (const offset of [-1, 0.5, NaN]) await assert.rejects(bookComments.listBookComments(db, firstId, offset), { status: 400 });
    await assert.rejects(bookComments.createBookComment(db, firstId, { ...input, content: ' ' }), { status: 400 });
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM poem_comments').first()).total, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM about_comments').first()).total, 0);
    await books.deleteBook(db, firstId, 1);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM book_comments').first()).total, 0);
    await assert.rejects(bookComments.listBookComments(db, firstId), { status: 404 });
    await assert.rejects(bookComments.createBookComment(db, firstId, input), { status: 404 });
  } finally { db.close(); }
});

for (const kind of ['poem', 'about', 'video', 'book']) test(`${kind}: moderation gates visibility, preserves retries and rejects stale decisions`, async () => {
  const db = database();
  const parent = crypto.randomUUID(), file = crypto.randomUUID();
  const entry = { id: crypto.randomUUID(), name: 'Cititor', content: '<script>alert(1)</script>\nText românesc', status: 'approved' };
  try {
    if (kind === 'poem') await service.createPoem(db, parent, input, readyMediaValidator);
    if (kind === 'video' || kind === 'book') {
      await db.prepare(`INSERT INTO ${kind}_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(file, 'fixture', 'file', kind === 'video' ? 'video/mp4' : 'application/pdf', 1, 'hash', 'pensio53@gmail.com', 1).run();
      await (kind === 'video' ? videos.createVideo : books.createBook)(db, parent, { title: 'Titlu', author: '', description: '', file_id: file }, kind === 'video' ? readyMediaValidator : readyBookValidator);
    }
    const create = value => kind === 'about' ? aboutComments.createAboutComment(db, value) : ({ poem: comments.createComment, video: videoComments.createVideoComment, book: bookComments.createBookComment })[kind](db, parent, value);
    const list = () => kind === 'about' ? aboutComments.listAboutComments(db) : ({ poem: comments.listComments, video: videoComments.listVideoComments, book: bookComments.listBookComments })[kind](db, parent);
    const count = async () => kind === 'about' ? (await list()).comments.length : (await ({ poem: service.listPoems, video: videos.listVideos, book: books.listBooks })[kind](db)).find(row => row.id === parent).comment_count;
    await create(entry);
    assert.equal((await list()).comments.length, 0); assert.equal(await count(), 0);
    let page = await moderation.listModerationComments(db, kind);
    assert.equal(page.total, 1); assert.equal(page.comments[0].status, 'pending'); assert.equal(page.comments[0].revision, 1);
    assert.equal(page.comments[0].content, entry.content);
    const approved = await moderation.moderateComment(db, kind, entry.id, 1, 'approved');
    assert.equal(approved.revision, 2);
    assert.deepEqual(await moderation.moderateComment(db, kind, entry.id, 1, 'approved'), approved);
    await create(entry);
    assert.equal((await list()).comments.length, 1); assert.equal(await count(), 1);
    await assert.rejects(moderation.moderateComment(db, kind, entry.id, 1, 'hidden'), { status: 409 });
    await assert.rejects(moderation.deleteModeratedComment(db, kind, entry.id, 1), { status: 409 });
    await moderation.moderateComment(db, kind, entry.id, 2, 'hidden');
    await create(entry);
    assert.equal((await list()).comments.length, 0); assert.equal(await count(), 0);
    page = await moderation.listModerationComments(db, kind, 'hidden');
    assert.deepEqual(page.counts, { pending: 0, approved: 0, hidden: 1 });
    assert.equal(page.comments[0].revision, 3); assert.ok(page.comments[0].moderated_at > 0);
    await assert.rejects(moderation.moderateComment(db, kind, entry.id, 1, 'approved'), { status: 409 });
    await moderation.moderateComment(db, kind, entry.id, 3, 'approved');
    await moderation.deleteModeratedComment(db, kind, entry.id, 4);
    await moderation.deleteModeratedComment(db, kind, entry.id, 4);
    assert.equal((await moderation.listModerationComments(db, kind, 'all')).total, 0);
    assert.equal(await count(), 0, 'Deleting one comment preserves its parent');
    await assert.rejects(moderation.moderateComment(db, kind, entry.id, 4, 'approved'), { status: 404 });
  } finally { db.close(); }
});

test('moderation filters and stable pagination isolate categories, including identical IDs', async () => {
  const db = database();
  try {
    await service.listPoems(db);
    const common = { id: crypto.randomUUID(), name: 'Cititor', content: 'Același identificator' };
    await comments.createComment(db, 'original-1', common);
    await aboutComments.createAboutComment(db, common);
    for (let i = 0; i < 21; i++) await aboutComments.createAboutComment(db, { ...common, id: crypto.randomUUID(), content: String(i) });
    const first = await moderation.listModerationComments(db);
    const second = await moderation.listModerationComments(db, 'all', 'pending', 20);
    assert.equal(first.total, 23); assert.equal(first.comments.length, 20); assert.equal(first.hasMore, true);
    assert.equal(second.comments.length, 3); assert.equal(second.hasMore, false);
    assert.equal(new Set([...first.comments, ...second.comments].map(row => row.kind + row.id)).size, 23);
    await moderation.deleteModeratedComment(db, 'poem', common.id, 1);
    assert.equal((await moderation.listModerationComments(db, 'about')).total, 22);
    assert.equal((await moderation.listModerationComments(db, 'poem')).total, 0);
    for (const bad of ['poem_comments', '__proto__', "poem'; DROP TABLE poems;--"]) await assert.rejects(moderation.listModerationComments(db, bad), { status: 400 });
    await assert.rejects(moderation.listModerationComments(db, 'all', 'public'), { status: 400 });
    for (const offset of [-1, NaN, 0.5, 1000001]) await assert.rejects(moderation.listModerationComments(db, 'all', 'all', offset), { status: 400 });
    await assert.rejects(moderation.moderateComment(db, 'about', common.id, 1, 'public'), { status: 400 });
    await assert.rejects(moderation.deleteModeratedComment(db, 'about', '../invalid', 1), { status: 400 });
  } finally { db.close(); }
});

test('image revalidation checks visibility before 304 and keeps private previews out of caches', async () => {
  const db = database(), imageId = crypto.randomUUID(), fileId = crypto.randomUUID(), bookId = crypto.randomUUID();
  const original = new Uint8Array([1, 2, 3]), derivative = new Uint8Array([4, 5]);
  let renders = 0;
  const bucket = { async get() { return { body: new Response(original).body, size: original.length }; } };
  const renderer = { async render() { renders++; return derivative; } };
  const owner = { 'oai-authenticated-user-email': 'pensio53@gmail.com' };
  const read = (headers = {}, query = '?w=320', method = 'GET', engine = renderer) => serveImage(db, bucket, engine, new Request('https://poetio.test/api/images/' + imageId + query, { headers, method }), imageId);
  try {
    await db.prepare('INSERT INTO poem_images VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(imageId, 'fixture', 'image.jpg', 'image/jpeg', 3, 'a'.repeat(64), 'pensio53@gmail.com', 1).run();
    assert.equal((await read()).status, 404); assert.equal(renders, 0);
    const preview = await read(owner); assert.equal(preview.headers.get('Cache-Control'), 'private, no-store');
    await service.createPoem(db, id, { ...input, image_id: imageId }, readyMediaValidator);
    const response = await read(); const etag = response.headers.get('ETag');
    assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/webp');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-cache');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), derivative);
    const previousRenders = renders;
    const cached = await read({ 'If-None-Match': '"different", W/' + etag });
    assert.equal(cached.status, 304); assert.equal(cached.body, null); assert.equal(renders, previousRenders);
    const head = await read({}, '?w=320', 'HEAD'); assert.equal(head.body, null); assert.equal(head.headers.get('Content-Length'), '2');
    const source = await read({}, ''); assert.deepEqual(new Uint8Array(await source.arrayBuffer()), original);
    assert.notEqual(source.headers.get('ETag'), etag);
    const fallback = await serveImage(db, bucket, undefined, new Request('https://poetio.test/api/images/' + imageId + '?w=320'), imageId);
    assert.equal(fallback.headers.get('Content-Type'), 'image/jpeg');
    assert.deepEqual(new Uint8Array(await fallback.arrayBuffer()), original);
    for (const w of ['0','999999','-1','NaN','', '320.5']) await assert.rejects(read({}, '?w='+w), { status: 400 });
    await service.updatePoem(db, id, 1, { ...input, image_id: null }, readyMediaValidator);
    assert.equal((await read({ 'If-None-Match': etag })).status, 404, 'A cached derivative cannot bypass detachment');
    assert.equal((await read({ 'oai-authenticated-user-email': 'other@example.com' })).status, 404);
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(fileId, 'fixture', 'book.pdf', 'application/pdf', 1, 'hash', 'pensio53@gmail.com', 1).run();
    await books.createBook(db, bookId, { title: 'Carte', author: '', description: '', file_id: fileId, image_id: imageId }, readyBookValidator);
    assert.equal((await read({ 'If-None-Match': etag })).status, 304, 'A published book also makes its cover readable');
    await books.deleteBook(db, bookId, 1);
    assert.equal((await read({ 'If-None-Match': etag })).status, 404);
    assert.equal((await read(owner)).status, 200, 'Owner can still preview detached original uploads');
  } finally { db.close(); }
});

for (const kind of ['poem','video']) test(`${kind}: atomic history preserves edits/deletion, retries add no duplicates and restoration uses current revision`, async () => {
  const db=database(), entity=crypto.randomUUID(),file=crypto.randomUUID();
  try {
    const value=kind==='poem'?input:{title:'Video test',author:'Autor',description:'Descriere',file_id:file};
    if(kind==='video')await db.prepare('INSERT INTO video_files VALUES(?,?,?,?,?,?,?,?)').bind(file,'fixture','file.mp4','video/mp4',1,'hash','pensio53@gmail.com',1).run();
    const create=kind==='poem'?service.createPoem:videos.createVideo, update=kind==='poem'?service.updatePoem:videos.updateVideo, remove=kind==='poem'?service.deletePoem:videos.deleteVideo;
    await create(db,entity,value,readyMediaValidator);await create(db,entity,value,readyMediaValidator);
    const history=async()=> (await db.prepare('SELECT * FROM content_history WHERE kind=? AND entity_id=? ORDER BY id').bind(kind,entity).all()).results;
    assert.equal((await history()).length,1);
    await update(db,entity,1,{...value,title:'Revizuit'},readyMediaValidator);await update(db,entity,1,{...value,title:'Revizuit'},readyMediaValidator);
    assert.equal((await history()).length,2);
    await assert.rejects(update(db,entity,1,{...value,title:'Conflict'},readyMediaValidator),{status:409});assert.equal((await history()).length,2);
    const first=(await history())[0];const recovered=(await editorial.recoveryItem(db,kind,'history',String(first.id))).snapshot;
    assert.equal(recovered.title,value.title);assert.equal(recovered.revision,2);assert.equal(recovered.isNew,false);
    await update(db,entity,recovered.revision,kind==='poem'?service.validateInput(recovered):recovered,readyMediaValidator);
    assert.equal((await history()).length,3);assert.equal(JSON.parse((await history())[1].snapshot).title,'Revizuit');
    await remove(db,entity,3);await remove(db,entity,3);
    assert.equal((await history()).length,4);assert.equal((await history())[3].event,'deleted');
    const deleted=(await editorial.recoveryItem(db,kind,'history',String(first.id))).snapshot;
    assert.equal(deleted.isNew,true);assert.equal(deleted.revision,1);
    await create(db,entity,kind==='poem'?service.validateInput(deleted):deleted,readyMediaValidator);assert.equal((await history()).length,5);
    await assert.rejects(editorial.recoveryItem(db,kind==='poem'?'video':'poem','history',String(first.id)),{status:404});
  } finally {db.close();}
});

test('private drafts accept unfinished text, preserve immutable retries, paginate and never publish', async()=>{
  const db=database();try{
    await service.listPoems(db);const before=(await service.listPoems(db)).length;
    const entry={id:crypto.randomUUID(),title:'Schiță <script>',author:'',theme:'',content:'Text neterminat\n',source_language:'ro',revision:1,isNew:true,pendingFiles:true};
    const draftId=crypto.randomUUID();await editorial.saveDraft(db,'poem',draftId,entry);await editorial.saveDraft(db,'poem',draftId,entry);
    assert.equal((await editorial.recoveryList(db,'poem','drafts',0)).entries.length,1);
    await assert.rejects(editorial.saveDraft(db,'poem',draftId,{...entry,title:'Diferit'}),{status:409});
    assert.equal((await service.listPoems(db)).length,before);
    const saved=(await editorial.recoveryItem(db,'poem','drafts',draftId)).snapshot;assert.equal(saved.content,entry.content);assert.equal(saved.pendingFiles,true);assert.equal(saved.isNew,true);
    for(let i=0;i<21;i++)await editorial.saveDraft(db,'poem',crypto.randomUUID(),entry);
    assert.equal((await editorial.recoveryList(db,'poem','drafts',0)).hasMore,true);assert.equal((await editorial.recoveryList(db,'poem','drafts',20)).entries.length,2);
    await assert.rejects(editorial.recoveryItem(db,'video','drafts',draftId),{status:404});
    for(const offset of [-1,0.5,NaN,1000001])await assert.rejects(editorial.recoveryList(db,'poem','drafts',offset),{status:400});
    assert.throws(()=>editorial.contentKind('__proto__'),{status:400});assert.throws(()=>editorial.draftSnapshot('poem',{...entry,content:'x'.repeat(30001)}),{status:400});
    await assert.rejects(editorial.recoveryItem(db,'poem','history','1 OR 1=1'),{status:400});
  }finally{db.close();}
});

test('book history preserves metadata, file references and deletion while recovery never publishes', async () => {
  const db = database(), entity = crypto.randomUUID(), fileId = crypto.randomUUID(), imageId = crypto.randomUUID();
  try {
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(fileId, 'fixture', 'book.pdf', 'application/pdf', 1, 'hash', 'pensio53@gmail.com', 1).run();
    await db.prepare('INSERT INTO poem_images VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(imageId, 'fixture', 'cover.jpg', 'image/jpeg', 1, 'hash', 'pensio53@gmail.com', 1).run();
    const value = { title: 'Prima ediție', author: 'Autor', description: 'Descriere\ncu diacritice ș, ț.', file_id: fileId, image_id: imageId };
    const history = async () => (await db.prepare("SELECT * FROM content_history WHERE kind='book' AND entity_id=? ORDER BY id").bind(entity).all()).results;
    await books.createBook(db, entity, value, readyBookValidator); await books.createBook(db, entity, value, readyBookValidator);
    assert.equal((await history()).length, 1);
    await books.updateBook(db, entity, 1, { ...value, title: 'Ediție revizuită' }, readyBookValidator);
    await books.updateBook(db, entity, 1, { ...value, title: 'Ediție revizuită' }, readyBookValidator);
    assert.equal((await history()).length, 2);
    await assert.rejects(books.updateBook(db, entity, 1, value, readyBookValidator), { status: 409 });
    const first = (await history())[0];
    const recovered = (await editorial.recoveryItem(db, 'book', 'history', String(first.id))).snapshot;
    assert.equal(recovered.revision, 2); assert.equal(recovered.isNew, false); assert.equal(recovered.description, value.description);
    assert.equal(recovered.file_id, fileId); assert.equal(recovered.image_id, imageId);
    assert.equal((await books.getBook(db, entity)).title, 'Ediție revizuită');
    assert.equal((await history()).length, 2, 'Previewing history does not write');
    await books.updateBook(db, entity, 2, recovered, readyBookValidator);
    assert.equal((await books.getBook(db, entity)).revision, 3);
    await books.deleteBook(db, entity, 3); await books.deleteBook(db, entity, 3);
    assert.equal((await history()).length, 4); assert.equal((await history())[3].event, 'deleted');
    const deleted = (await editorial.recoveryItem(db, 'book', 'history', String((await history())[3].id))).snapshot;
    assert.equal(deleted.isNew, true); assert.equal(deleted.revision, 1); assert.equal(deleted.file_id, fileId);
    assert.equal(await books.getBook(db, entity), null);
    await assert.rejects(books.createBook(db, entity, deleted, { validation: async () => ({ status: 'error', code: 'invalid', pages: 2, checkedPages: 1 }) }), { status: 422 });
    assert.equal((await history()).length, 4, 'Recovery does not bypass PDF validation');
    await books.createBook(db, entity, deleted, readyBookValidator);
    assert.equal((await history()).length, 5);
    await assert.rejects(editorial.recoveryItem(db, 'video', 'history', String(first.id)), { status: 404 });
  } finally { db.close(); }
});

test('book drafts preserve incomplete metadata and pending uploads privately with safe retries', async () => {
  const db = database();
  try {
    editorial.contentKind('book');
    const entry = { id: crypto.randomUUID(), title: '', author: '', description: 'Descriere nesalvată\n', file_id: '', image_id: null, revision: 1, isNew: true, pendingBookFile: true, pendingCover: true };
    const id = crypto.randomUUID();
    await editorial.saveDraft(db, 'book', id, entry); await editorial.saveDraft(db, 'book', id, entry);
    const recovered = (await editorial.recoveryItem(db, 'book', 'drafts', id)).snapshot;
    assert.equal(recovered.description, entry.description); assert.equal(recovered.pendingFiles, true); assert.equal(recovered.pendingBookFile, true); assert.equal(recovered.pendingCover, true);
    assert.equal(recovered.file_id, ''); assert.equal(recovered.image_id, null); assert.equal(recovered.isNew, true);
    assert.equal((await books.listBooks(db)).length, 0);
    assert.equal((await editorial.recoveryList(db, 'book', 'history', 0)).entries.length, 0);
    assert.equal((await editorial.recoveryList(db, 'book', 'drafts', 0)).entries.length, 1);
    await assert.rejects(editorial.saveDraft(db, 'book', id, { ...entry, title: 'Alte date' }), { status: 409 });
    await assert.rejects(editorial.recoveryItem(db, 'poem', 'drafts', id), { status: 404 });
    for (const change of [{ id: 'original-1' }, { file_id: '../file' }, { image_id: 'bad' }, { description: 'x'.repeat(5001) }]) assert.throws(() => editorial.draftSnapshot('book', { ...entry, ...change }), { status: 400 });
    for (let i = 0; i < 20; i++) await editorial.saveDraft(db, 'book', crypto.randomUUID(), entry);
    assert.equal((await editorial.recoveryList(db, 'book', 'drafts', 0)).hasMore, true);
    assert.equal((await editorial.recoveryList(db, 'book', 'drafts', 20)).entries.length, 1);
  } finally { db.close(); }
});

test('PDF upload rejects invalid files before storage and requires a validator', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-upload-validation-'));
  const db = database(), renderer = openBookRenderer(directory);
  let writes = 0;
  const bucket = { async put() { writes++; } };
  const upload = bytes => new Request('https://poetio.test/api/book-files', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Upload-Id': crypto.randomUUID(), 'oai-authenticated-user-email': 'pensio53@gmail.com' }, body: bytes });
  try {
    for (const bytes of [Buffer.from('%PDF-1.4'), bookFixture().subarray(0, -6), readFileSync(new URL('./fixtures/password-protected.pdf', import.meta.url))]) {
      await assert.rejects(bookFiles.saveBookFile(db, bucket, upload(bytes), renderer), { status: 422 });
    }
    await assert.rejects(bookFiles.saveBookFile(db, bucket, upload(bookFixture())), { status: 503 });
    assert.equal(writes, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS total FROM book_files').first()).total, 0);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('book publication waits for every page and legacy invalid files cannot replace a readable book', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-publication-validation-'));
  const db = database(), renderer = openBookRenderer(directory), bucket = openBookBucket(join(directory, 'books'));
  const owner = 'pensio53@gmail.com', id = crypto.randomUUID();
  const upload = (bytes, fileId = crypto.randomUUID()) => new Request('https://poetio.test/api/book-files', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Upload-Id': fileId, 'oai-authenticated-user-email': owner }, body: bytes });
  const input = file => ({ title: 'Carte verificată', author: '', description: '', file_id: file.id });
  try {
    const valid = await bookFiles.saveBookFile(db, bucket, upload(bookFixture()), renderer);
    await assert.rejects(books.createBook(db, id, input(valid)), { status: 503 });
    await assert.rejects(books.createBook(db, id, input(valid), renderer), { status: 409 });
    assert.equal((await books.listBooks(db)).length, 0);
    assert.equal((await finishedBookValidation(renderer, valid)).status, 'ready');
    assert.equal((await books.createBook(db, id, input(valid), renderer)).revision, 1);
    assert.equal((await books.createBook(db, id, input(valid), renderer)).revision, 1);
    const retryUpload = await bookFiles.saveBookFile(db, bucket, upload(bookFixture(), valid.id), renderer);
    assert.equal(retryUpload.id, valid.id);

    const laterBroken = await bookFiles.saveBookFile(db, bucket, upload(bookFixture({ brokenSecondPage: true })), renderer);
    assert.equal((await finishedBookValidation(renderer, laterBroken)).status, 'error');
    await assert.rejects(books.createBook(db, crypto.randomUUID(), input(laterBroken), renderer), { status: 422 });
    await assert.rejects(books.updateBook(db, id, 1, input(laterBroken), renderer), { status: 422 });

    // Old uploads have no validation marker. Inserting a legacy row must never
    // be enough to authorize publication through either POST or PUT.
    const legacyId = crypto.randomUUID(), bytes = Buffer.from('%PDF-1.4');
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    const key = `books/${legacyId}/${hash}`;
    await bucket.put(key, bytes);
    await db.prepare('INSERT INTO book_files VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(legacyId, key, 'vechi.pdf', 'application/pdf', bytes.length, hash, owner, Date.now()).run();
    const legacy = await bookFiles.getBookFile(db, legacyId);
    assert.equal((await finishedBookValidation(renderer, legacy)).status, 'error');
    await assert.rejects(books.createBook(db, crypto.randomUUID(), input(legacy), renderer), { status: 422 });
    await assert.rejects(books.updateBook(db, id, 1, input(legacy), renderer), { status: 422 });
    const unchanged = await books.getBook(db, id);
    assert.equal(unchanged.file_id, valid.id); assert.equal(unchanged.revision, 1);
    assert.equal((await books.listBooks(db)).length, 1);
    assert.equal((await renderer.page(valid, 2)).length > 0, true);
    const malformedValidator = { async validation() { return { status: 'ready', pages: 2, checkedPages: 1 }; } };
    await assert.rejects(books.createBook(db, crypto.randomUUID(), input(valid), malformedValidator), { status: 503 });
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

async function collectionFixture(count = 27) {
  const db = database();
  await db.prepare("INSERT INTO collection_meta VALUES ('initial_poems_v1','complete'), ('poem_languages_v1','complete')").run();
  const ids = Array.from({ length: count }, (_, i) => `12345678-0000-4000-8000-${String(i).padStart(12, '0')}`);
  for (let i = count - 1; i >= 0; i--) {
    await db.prepare(`INSERT INTO poems(id,title,author,theme,content,source_language,translated_title,translated_theme,translated_content,revision,created_at,updated_at)
      VALUES(?,?,?,?,?,'ro',?,?,?,1,?,?)`).bind(ids[i], `Titlu ${i}`, 'Autor', i % 2 ? 'Lumină' : 'Memorie', 'x'.repeat(29960) + ` ȘȚÂÎĂ FINAL_ORIGINAL_${i}`, i % 2 ? null : `English title ${i}`, null, i % 2 ? null : 'y'.repeat(29960) + ` translated needle ${i}`, Math.floor(i / 4), Math.floor(i / 4)).run();
  }
  return { db, ids };
}

test('public collection pages stay bounded in SQL and cover tied timestamps once in stable order', async () => {
  const { db, ids } = await collectionFixture(100);
  try {
    const first = await listPoemCards(db);
    assert.equal(first.total, 100); assert.equal(first.pages, 9); assert.equal(first.poems.length, 12);
    assert.ok(Buffer.byteLength(JSON.stringify(first)) < 15000);
    assert.doesNotMatch(JSON.stringify(first), /FINAL_ORIGINAL|translated needle|English title/);
    const expectedKeys = ['id','author','image_id','source_language','title','theme','excerpt','language','has_translation','comment_count'].sort();
    for (const poem of first.poems) {
      assert.deepEqual(Object.keys(poem).sort(), expectedKeys);
      assert.ok(Array.from(poem.excerpt).length <= 240);
      assert.equal(poem.excerpt.at(-1), '…');
    }
    const collected = [];
    for (let page = 1; page <= first.pages; page++) {
      const result = await listPoemCards(db, { page: String(page) });
      assert.ok(result.poems.length <= 12);
      collected.push(...result.poems.map(poem => poem.id));
    }
    assert.deepEqual(collected, ids);
    assert.equal((await listPoemCards(db, { page: '9999999' })).page, 9);
    for (const page of ['-1', '1.5', 'Infinity', '1e8', '10000000']) assert.equal((await listPoemCards(db, { page })).page, 1);
    const plan = await db.prepare('EXPLAIN QUERY PLAN SELECT id FROM poems ORDER BY created_at,id LIMIT 12 OFFSET 12').all();
    assert.match(JSON.stringify(plan), /idx_poems_collection_order/);
    assert.doesNotMatch(JSON.stringify(plan), /TEMP B-TREE/);
  } finally { db.close(); }
});

test('search reaches full original and translated text; filters combine without leaking full texts', async () => {
  const { db, ids } = await collectionFixture();
  try {
    assert.equal((await listPoemCards(db, { q: 'staia' })).total, 27);
    assert.equal((await listPoemCards(db, { q: 'ȘȚÂÎĂ', theme: 'LUMINA', translation: 'without' })).total, 13);
    const translated = await listPoemCards(db, { q: 'translated needle 26', translation: 'with', lang: 'en-US' });
    assert.deepEqual(translated.poems.map(poem => poem.id), [ids[26]]);
    assert.equal(translated.poems[0].title, 'English title 26');
    assert.equal(translated.poems[0].language, 'en-US');
    assert.doesNotMatch(JSON.stringify(translated.poems), /translated needle|FINAL_ORIGINAL|Titlu/);
    const fallback = await listPoemCards(db, { translation: 'without', lang: 'en-US' });
    assert.equal(fallback.poems[0].language, 'ro');
    assert.equal(fallback.poems[0].has_translation, false);
    assert.equal((await listPoemCards(db, { q: "' OR 1=1 --" })).total, 0);
    assert.equal((await listPoemCards(db, { q: '%' })).total, 0);
    await db.prepare('UPDATE poems SET content=? WHERE id=?').bind('100%_literal\nAl doilea vers\nAl treilea', ids[0]).run();
    const literal = await listPoemCards(db, { q: '%_' });
    assert.equal(literal.total, 1); assert.equal(literal.poems[0].excerpt, '100%_literal\nAl doilea vers…');
    const none = await listPoemCards(db, { theme: 'absent', page: '5' });
    assert.equal(none.page, 1); assert.equal(none.total, 0); assert.deepEqual(none.poems, []);
  } finally { db.close(); }
});

test('collection bounds Unicode excerpts, input lengths and URL parameters', async () => {
  const { db, ids } = await collectionFixture(1);
  try {
    await db.prepare('UPDATE poems SET content=? WHERE id=?').bind(' \n\t' + '🌙'.repeat(400), ids[0]).run();
    const result = await listPoemCards(db);
    assert.equal(Array.from(result.poems[0].excerpt).length, 240);
    assert.equal(result.poems[0].excerpt, '🌙'.repeat(239) + '…');
    const parsed = collectionQuery({ q: 'x'.repeat(1000), theme: 'a'.repeat(1000), lang: ['en-US','ro'], translation: 'invalid', page: '2' });
    assert.equal(parsed.filters.q.length, 120); assert.equal(parsed.filters.theme.length, 80);
    assert.equal(parsed.filters.translation, 'all'); assert.equal(parsed.filters.language, 'en-US');
    const href = collectionHref({ ...parsed.filters, q: '<script>&Ș', theme: 'Lumină', translation: 'with' }, 2);
    const url = new URL(href, 'https://example.test');
    assert.equal(url.searchParams.get('q'), '<script>&Ș'); assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.hash, '#collection');
    assert.equal(collectionReturnHref(href, 'ro'), href);
    for (const invalid of ['https://elsewhere.test/', '//elsewhere.test/', 'javascript:alert(1)', '/admin']) assert.equal(collectionReturnHref(invalid, 'ro'), '/?lang=ro#collection');
    assert.deepEqual(await listPoemCards(db, { page: '2' }), await listPoemCards(db), 'Last page remains reachable after the collection shrinks');
  } finally { db.close(); }
});

test('translation provenance binds source and translated text, with exact API normalization', async () => {
  const pair = { ...input, source_language: 'ro', translated_title: 'Homecoming', translated_theme: 'Memories', translated_content: '  First line\nSecond line\n' };
  pair.translation_provenance = await translationProvenance(pair, 'automatic');
  assert.equal(await translationStatus(pair), 'ready');
  assert.equal(await translationStatus({ ...pair, author: 'Another author', image_id: 'unused', revision: 99 }), 'ready');
  assert.equal(await translationStatus({ ...pair, title: '  ' + pair.title + ' ', theme: ' ' + pair.theme, content: pair.content.replace(/\n/g, '\r\n'), translated_content: pair.translated_content.replace(/\n/g, '\r\n') }), 'ready');
  for (const change of [{ title: pair.title + '!' }, { theme: 'New theme' }, { content: pair.content + '\n' }, { source_language: 'en-US' }]) assert.equal(await translationStatus({ ...pair, ...change }), 'stale');
  for (const change of [{ translated_title: 'New title' }, { translated_theme: 'New theme' }, { translated_content: pair.translated_content + ' ' }]) assert.equal(await translationStatus({ ...pair, ...change }), 'edited');
  assert.equal(await translationStatus({ ...pair, translation_provenance: null }), 'unreviewed');
  assert.equal(await translationStatus({ ...pair, translated_title: '' }), 'incomplete');
  assert.equal(await translationStatus({ ...input }), 'missing');
  for (const malformed of ['serialized JSON', [], { ...pair.translation_provenance, version: 2 }, { ...pair.translation_provenance, origin: 'unknown' }, { ...pair.translation_provenance, sourceHash: 'bad' }]) {
    assert.equal(parseTranslationProvenance(malformed), null);
    assert.throws(() => service.validateInput({ ...pair, translation_provenance: malformed }), { status: 400 });
  }
});

test('public saves reject stale or unreviewed translations without changing revisions or history', async () => {
  const db = database();
  const pair = { ...input, source_language: 'ro', translated_title: 'Homecoming', translated_theme: 'Memories', translated_content: 'The sun rises.' };
  try {
    await assert.rejects(service.createPoem(db, id, pair, readyMediaValidator), { status: 409 });
    pair.translation_provenance = await translationProvenance(pair, 'automatic');
    await service.createPoem(db, id, pair, readyMediaValidator);
    const history = () => editorial.recoveryList(db, 'poem', 'history', 0);
    const before = await history();
    for (const change of [{ title: 'Titlu nou' }, { content: 'Luna apune.' }, { theme: 'Luna' }, { source_language: 'en-US' }, { translated_content: 'The moon sets.' }, { translation_provenance: null }]) {
      await assert.rejects(service.updatePoem(db, id, 1, { ...pair, ...change }, readyMediaValidator), { status: 409 });
      await assert.rejects(service.createPoem(db, crypto.randomUUID(), { ...pair, ...change }, readyMediaValidator), { status: 409 });
    }
    assert.equal((await service.getPoem(db, id)).revision, 1);
    assert.deepEqual(await history(), before);
    const reviewed = { ...pair, content: 'Luna apune.', translated_content: 'The moon sets.' };
    reviewed.translation_provenance = await translationProvenance(reviewed, 'manual');
    const saved = await service.updatePoem(db, id, 1, reviewed, readyMediaValidator);
    assert.equal(saved.revision, 2); assert.deepEqual(saved.translation_provenance, reviewed.translation_provenance);
    assert.deepEqual(await service.updatePoem(db, id, 1, reviewed, readyMediaValidator), saved, 'Lost response retries reuse the same verified translation');
    const changedAuthor = await service.updatePoem(db, id, 2, { ...reviewed, author: 'Autor schimbat' }, readyMediaValidator);
    assert.deepEqual(changedAuthor.translation_provenance, reviewed.translation_provenance);
    const originalOnly = await service.updatePoem(db, id, 3, { ...reviewed, translated_title: null, translated_theme: null, translated_content: null }, readyMediaValidator);
    assert.equal(originalOnly.translation_provenance, null);
    assert.equal(originalOnly.translated_content, null);
  } finally { db.close(); }
});

test('legacy translations stay visible but cannot be attached to a changed original without review', async () => {
  const db = database();
  try {
    await service.createPoem(db, id, input, readyMediaValidator);
    await db.prepare('UPDATE poems SET translated_title=?,translated_content=? WHERE id=?').bind('Legacy title', 'Legacy content', id).run();
    const legacy = await service.getPoem(db, id);
    assert.equal(legacy.translation_provenance, null);
    assert.equal(await translationStatus(legacy), 'unreviewed');
    const metadata = await service.updatePoem(db, id, 1, { ...legacy, author: 'Author changed' }, readyMediaValidator);
    assert.equal(metadata.translated_content, legacy.translated_content);
    await assert.rejects(service.updatePoem(db, id, 2, { ...metadata, content: 'Original changed' }, readyMediaValidator), { status: 409 });
    const oldClient = await service.updatePoem(db, id, 2, { ...input, content: 'Original changed' }, readyMediaValidator);
    assert.equal(oldClient.translated_content, null); assert.equal(oldClient.translation_provenance, null);
  } finally { db.close(); }
});

test('private drafts and saved/deleted history preserve provenance; recovering never validates stale text', async () => {
  const db = database();
  const pair = { ...input, source_language: 'ro', translated_title: 'Homecoming', translated_theme: '', translated_content: 'The sun rises.' };
  pair.translation_provenance = await translationProvenance(pair, 'automatic');
  try {
    const poem = await service.createPoem(db, id, pair, readyMediaValidator);
    const draftId = crypto.randomUUID();
    const stale = { ...poem, content: 'Luna apune.', isNew: false };
    await editorial.saveDraft(db, 'poem', draftId, stale);
    const recoveredDraft = (await editorial.recoveryItem(db, 'poem', 'drafts', draftId)).snapshot;
    assert.deepEqual(recoveredDraft.translation_provenance, pair.translation_provenance);
    assert.equal(await translationStatus(recoveredDraft), 'stale');
    await assert.rejects(service.updatePoem(db, id, 1, service.validateInput(recoveredDraft), readyMediaValidator), { status: 409 });
    await service.deletePoem(db, id, 1);
    const versions = (await editorial.recoveryList(db, 'poem', 'history', 0)).entries.filter(row => row.entity_id === id);
    assert.equal(versions.length, 2);
    for (const version of versions) {
      const restored = (await editorial.recoveryItem(db, 'poem', 'history', String(version.id))).snapshot;
      assert.equal(restored.isNew, true);
      assert.deepEqual(restored.translation_provenance, pair.translation_provenance);
      assert.equal(await translationStatus(restored), 'ready');
      assert.equal(await translationStatus({ ...restored, content: 'Un alt original' }), 'stale');
    }
    assert.equal(await service.getPoem(db, id), null);
  } finally { db.close(); }
});

test('real audio/video verification blocks uploads and legacy publication, preserves edits and allows valid replacements', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-media-integration-')), db = database();
  const validator = openMediaValidator(directory), audioBucket = openAudioBucket(join(directory, 'audio')), videoBucket = openVideoBucket(join(directory, 'videos'));
  const owner = 'pensio53@gmail.com';
  const upload = (kind, bytes, type, id = crypto.randomUUID()) => new Request('https://poetio.test/api/' + (kind === 'audio' ? 'audio' : 'video-files'), { method:'POST',headers:{ 'oai-authenticated-user-email':owner,'X-Upload-Id':id,'Content-Type':type },body:bytes });
  const malformedVideo = Buffer.alloc(32); malformedVideo.writeUInt32BE(32); malformedVideo.write('ftypisom', 4);
  const malformedAudio = Buffer.alloc(44); malformedAudio.write('RIFF'); malformedAudio.writeUInt32LE(36, 4); malformedAudio.write('WAVE', 8);
  async function legacy(kind, bytes, type) {
    const id = crypto.randomUUID(), hash = createHash('sha256').update(bytes).digest('hex'), key = `${kind === 'audio' ? 'poem-audio' : 'videos'}/${id}/${hash}`;
    await (kind === 'audio' ? audioBucket : videoBucket).put(key, bytes);
    await db.prepare(`INSERT INTO ${kind === 'audio' ? 'poem_audio' : 'video_files'} VALUES (?,?,?,?,?,?,?,?)`).bind(id,key,'legacy',type,bytes.length,hash,owner,1).run();
    return id;
  }
  try {
    await assert.rejects(audio.saveAudio(db,audioBucket,upload('audio',malformedAudio,'audio/wav'),validator), {status:422});
    await assert.rejects(videoFiles.saveVideoFile(db,videoBucket,upload('video',malformedVideo,'video/mp4'),validator), {status:422});
    await assert.rejects(audio.saveAudio(db,audioBucket,upload('audio',wavFixture(),'audio/wav')), {status:503});
    await assert.rejects(videoFiles.saveVideoFile(db,videoBucket,upload('video',mediaFixture('clip.mp4'),'video/mp4')), {status:503});
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM poem_audio').first()).n,0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM video_files').first()).n,0);
    assert.deepEqual(readdirSync(directory), [], 'Rejected uploads leave no persisted objects');
    const file = await audio.saveAudio(db,audioBucket,upload('audio',wavFixture(),'audio/wav'),validator);
    const movie = await videoFiles.saveVideoFile(db,videoBucket,upload('video',mediaFixture('clip.mp4'),'video/mp4'),validator);
    const badAudio = await legacy('audio',malformedAudio,'audio/wav'), badVideo = await legacy('video',malformedVideo,'video/mp4');
    await assert.rejects(service.createPoem(db,crypto.randomUUID(),{...input,audio_ro_id:badAudio},validator),{status:422});
    await assert.rejects(videos.createVideo(db,crypto.randomUUID(),{title:'Invalid',author:'',description:'',file_id:badVideo},validator),{status:422});
    await assert.rejects(service.createPoem(db,crypto.randomUUID(),{...input,audio_ro_id:file.id}),{status:503});
    await assert.rejects(videos.createVideo(db,crypto.randomUUID(),{title:'Valid',author:'',description:'',file_id:movie.id}),{status:503});
    const poemId = crypto.randomUUID(), videoId = crypto.randomUUID();
    const poem = await service.createPoem(db,poemId,{...input,audio_ro_id:file.id},validator);
    const video = await videos.createVideo(db,videoId,{title:'Valid',author:'',description:'Kept',file_id:movie.id},validator);
    const history = await db.prepare('SELECT COUNT(*) AS n FROM content_history').first();
    await assert.rejects(service.updatePoem(db,poemId,1,{...input,title:'Not published',audio_ro_id:badAudio},validator),{status:422});
    await assert.rejects(videos.updateVideo(db,videoId,1,{...video,title:'Not published',file_id:badVideo},validator),{status:422});
    assert.deepEqual(await service.getPoem(db,poemId),poem); assert.deepEqual(await videos.getVideo(db,videoId),video);
    assert.deepEqual(await db.prepare('SELECT COUNT(*) AS n FROM content_history').first(),history);
    const draftId=crypto.randomUUID(); await editorial.saveDraft(db,'video',draftId,{...video,file_id:badVideo,isNew:false});
    const recovered=(await editorial.recoveryItem(db,'video','drafts',draftId)).snapshot;
    await assert.rejects(videos.updateVideo(db,videoId,1,recovered,validator),{status:422});
    const replaced=await videos.updateVideo(db,videoId,1,{...video,title:'New valid title'},validator);assert.equal(replaced.revision,2);
    // Even a client that omits audio fields cannot retain an unchecked legacy reference.
    await db.prepare('UPDATE poems SET audio_ro_id=? WHERE id=?').bind(badAudio,poemId).run();
    await assert.rejects(service.updatePoem(db,poemId,1,{...input,author:'Edited'},validator),{status:422});
    const repaired=await service.updatePoem(db,poemId,1,{...input,audio_ro_id:file.id},validator);assert.equal(repaired.revision,2);
    const removed=await service.updatePoem(db,poemId,2,{...input,audio_ro_id:null},validator);assert.equal(removed.audio_ro_id,null);
    const incomplete={async checkUpload(){return {status:'ready'};},async validation(){return {status:'ready'};}};
    await assert.rejects(audio.saveAudio(db,audioBucket,upload('audio',wavFixture(),'audio/wav'),incomplete),{status:503});
  } finally { db.close(); rmSync(directory,{recursive:true,force:true}); }
});


test('admin poem summaries paginate stably, search both languages, and never return unselected text', async () => {
  const db = database();
  try {
    await service.listPoems(db);
    await db.prepare('DELETE FROM poems').run();
    const body = 'Original secret '.repeat(2000), translated = 'Traducere secretă '.repeat(1500);
    const ids = Array.from({ length: 43 }, (_, n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
    for (let i = 0; i < ids.length; i++) await db.prepare(`INSERT INTO poems (id,title,author,theme,content,source_language,translated_title,translated_theme,translated_content,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,'ro',?,?,?,1,1,1)`).bind(ids[i], 'Titlu ' + i, i === 42 ? 'Ştefan Ţepeş' : 'Autor', 'Pădure', body + (i === 42 ? ' acasă' : ''), 'Title ' + i, '', translated + (i === 41 ? ' raretoken' : '')).run();
    const first = await listAdminPoems(db), second = await listAdminPoems(db, { page: '2' }), last = await listAdminPoems(db, { page: '9999999' });
    assert.equal(first.total, 43); assert.equal(first.pages, 3); assert.equal(first.poems.length, 20);
    assert.equal(second.page, 2); assert.equal(second.poems.length, 20); assert.equal(last.page, 3); assert.equal(last.poems.length, 3);
    assert.deepEqual([...first.poems, ...second.poems, ...last.poems].map(p => p.id), ids);
    assert(JSON.stringify(first).length < 4000, 'The list size stays bounded despite long bilingual poems');
    for (const poem of first.poems) assert.deepEqual(Object.keys(poem).sort(), ['author', 'id', 'image_id', 'title']);
    assert.equal((await listAdminPoems(db, { q: 'acasĂ' })).poems[0].id, ids[42]);
    assert.equal((await listAdminPoems(db, { q: 'rareto' })).poems[0].id, ids[41]);
    assert.equal((await listAdminPoems(db, { q: 'stefan tepes' })).poems[0].id, ids[42]);
    assert.equal((await listAdminPoems(db, { q: 'PADURE' })).total, 43);
    assert.equal((await listAdminPoems(db, { q: '%_ OR 1=1' })).total, 0);
    assert.equal((await listAdminPoems(db, { page: '-1', q: 'x'.repeat(150) })).q.length, 120);
    assert.equal((await service.getPoem(db, ids[42])).content, body + ' acasă', 'Selected poem is read in full');
    for (const id of ids.slice(40)) await db.prepare('DELETE FROM poems WHERE id=?').bind(id).run();
    assert.equal((await listAdminPoems(db, { page: '3' })).page, 2, 'Deleting the last page clamps the next reload');
    await db.prepare('DELETE FROM poems').run();
    const empty = await listAdminPoems(db);
    assert.equal(empty.total, 0); assert.equal(empty.page, 1); assert.equal(empty.pages, 1); assert.deepEqual(empty.poems, []);
  } finally { db.close(); }
});
