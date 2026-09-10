import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';

const output = mkdtempSync(join(tmpdir(), 'stillword-tests-'));
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}');
for (const file of ['db/poems', 'db/seed-poems', 'db/images', 'db/language-backfill', 'lib/access', 'lib/poem-images', 'lib/poem-languages', 'lib/translate-poem']) {
  mkdirSync(join(output, file.split('/')[0]), { recursive: true });
  const source = readFileSync(new URL(`../${file}.ts`, import.meta.url), 'utf8');
  writeFileSync(join(output, file + '.js'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
}
process.on('exit', () => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const service = require(join(output, 'db/poems.js'));
const access = require(join(output, 'lib/access.js'));
const { poemVersion, needsEnglishTranslation } = require(join(output, 'lib/poem-languages.js'));
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

test('persistent collection supports create, retry, exact Romanian text, edit and delete', async () => {
  const db = database();
  try {
    assert.equal((await service.listPoems(db)).length, 6);
    const created = await service.createPoem(db, id, service.validateInput(input));
    assert.equal(created.content, input.content);
    await service.createPoem(db, id, input);
    assert.equal((await service.listPoems(db)).length, 7, 'Retry must not duplicate the poem');
    const updated = await service.updatePoem(db, id, 1, { ...input, title: 'Întoarcere, revizuit' });
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
    await service.createPoem(db, id, input);
    const edited = { ...input, title: 'Varianta nouă' };
    await service.updatePoem(db, id, 1, edited);
    assert.equal((await service.updatePoem(db, id, 1, edited)).revision, 2, 'Safe retry does not increment twice');
    await assert.rejects(service.updatePoem(db, id, 1, input), { status: 409 });
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
    const poem = await service.createPoem(db, id, service.validateInput(malicious));
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
    await service.updatePoem(db, english.id, english.revision, { title: english.title, author: english.author, theme: english.theme, content: english.content, translated_title: null, translated_theme: null, translated_content: null });
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
  try {
    const poem = await service.createPoem(db, id, service.validateInput(bilingual));
    assert.equal(poemVersion(poem, 'ro').content, input.content);
    assert.equal(poemVersion(poem, 'en-US').content, bilingual.translated_content);
    const authorOnly = await service.updatePoem(db, id, 1, { ...input, author: 'Autor editat' });
    assert.equal(authorOnly.translated_content, bilingual.translated_content, 'Older forms preserve translations when only shared metadata changes');
    const changedSource = await service.updatePoem(db, id, 2, { ...input, content: 'Un poem nou.' });
    assert.equal(changedSource.translated_content, null, 'An older form cannot leave a translation attached to changed source text');
    assert.equal(poemVersion(changedSource, 'en-US'), null);
    assert.throws(() => service.validateInput({ ...bilingual, source_language: 'fr' }), { status: 400 });
    assert.throws(() => service.validateInput({ ...bilingual, translated_content: '' }), { status: 400 });
    assert.throws(() => service.validateInput({ ...bilingual, translated_content: 'x'.repeat(30001) }), { status: 400 });
  } finally { db.close(); }
});

test('automatic translation refreshes changed Romanian originals and preserves manual revisions', () => {
  const draft = { ...input, source_language: 'ro', translated_title: '', translated_theme: '', translated_content: '' };
  assert.equal(needsEnglishTranslation(draft), true);
  const translated = { ...draft, translated_title: 'Homecoming', translated_content: 'First line\nSecond line' };
  assert.equal(needsEnglishTranslation(translated), false);
  assert.equal(needsEnglishTranslation(translated, translated), false);
  const edited = { ...translated, title: 'Întoarcere acasă' };
  assert.equal(needsEnglishTranslation(edited, translated), true);
  assert.equal(needsEnglishTranslation({ ...edited, translated_title: 'Returning Home' }, translated), false);
  assert.equal(needsEnglishTranslation({ ...draft, source_language: 'en-US' }), false);
  assert.equal(needsEnglishTranslation({ ...translated, image_id: 'test-image' }, translated), false);
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
    const saved = await service.createPoem(db, id, savedInput);
    assert.equal(saved.content, original.content);
    assert.equal(poemVersion(saved, 'en-US').content, generated.translated_content);
    assert.equal((await service.createPoem(db, id, savedInput)).revision, 1);
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
