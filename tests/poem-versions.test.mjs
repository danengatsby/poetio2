import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { migrate } from '../scripts/migrate.mjs';
import { openDatabase } from '../server/vps-storage.mjs';

const poems = await tsImport('../db/poems.ts', import.meta.url);
const { listPoemCards } = await tsImport('../db/poem-collection.ts', import.meta.url);
const { translationProvenance, translationStatus } = await tsImport(
  '../lib/translation-provenance.ts',
  import.meta.url,
);
const { poemVersion } = await tsImport('../lib/poem-languages.ts', import.meta.url);

async function store(t) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-french-'));
  const file = join(directory, 'poetio.sqlite3');
  await migrate(file, { create: true });
  const db = openDatabase(file);
  // Without the sample poems a new database would otherwise receive.
  await db
    .prepare("INSERT INTO collection_meta VALUES ('initial_poems_v1','complete'),('poem_languages_v1','complete')")
    .run();
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return db;
}

const original = {
  title: 'Roata de fum',
  author: 'Dan Enache',
  theme: 'iubire',
  content: 'Sunt prins în roata vieții\nde-o vreme.',
  source_language: 'ro',
  translated_title: 'The wheel of smoke',
  translated_theme: 'love',
  translated_content: 'I am caught in the wheel of life\nfor a while.',
};
const french = {
  fr_title: 'La roue de fumée',
  fr_theme: 'amour',
  fr_content: 'Je suis pris dans la roue de la vie\ndepuis un temps.',
};
async function withProvenance(poem) {
  return {
    ...poem,
    translation_provenance: await translationProvenance(poem, 'manual'),
    fr_provenance: poem.fr_content ? await translationProvenance(poem, 'automatic', 'fr') : null,
  };
}

test('a poem keeps a French version with its own provenance, shown and searched in French', async t => {
  const db = await store(t);
  const id = crypto.randomUUID();
  const saved = await poems.createPoem(db, id, poems.validateInput(await withProvenance({ ...original, ...french })));
  assert.equal(saved.fr_title, 'La roue de fumée');
  assert.equal(saved.fr_provenance.origin, 'automatic');
  assert.equal(await translationStatus(saved, 'fr'), 'ready');
  assert.equal(await translationStatus(saved), 'ready');
  assert.deepEqual(poemVersion(saved, 'fr'), { title: 'La roue de fumée', theme: 'amour', content: french.fr_content });
  assert.equal(poemVersion(saved, 'en-US').title, 'The wheel of smoke');
  assert.equal(poemVersion(saved, 'ro').title, 'Roata de fum');

  const card = (await listPoemCards(db, { lang: 'fr' }, 'fr')).poems[0];
  assert.equal(card.title, 'La roue de fumée');
  assert.equal(card.theme, 'amour');
  assert.equal(card.language, 'fr');
  assert.equal(card.has_translation, true);
  assert.equal((await listPoemCards(db, { lang: 'fr', q: 'fumée' }, 'fr')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'fr', q: 'FUMÉE' }, 'fr')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'fr', theme: 'amour' }, 'fr')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'en-US', q: 'roue' }, 'en-US')).total, 1);
});

test('without a French version the French site shows the original; filters count French versions', async t => {
  const db = await store(t);
  const plain = crypto.randomUUID();
  await poems.createPoem(db, plain, poems.validateInput(await withProvenance(original)));
  const card = (await listPoemCards(db, { lang: 'fr' }, 'fr')).poems[0];
  assert.equal(card.title, 'Roata de fum');
  assert.equal(card.language, 'ro');
  assert.equal(card.has_translation, false);
  assert.equal((await listPoemCards(db, { lang: 'fr', translation: 'without' }, 'fr')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'fr', translation: 'with' }, 'fr')).total, 0);
  assert.equal((await listPoemCards(db, { lang: 'en-US', translation: 'with' }, 'en-US')).total, 1);
});

test('the French version is checked, kept by clients that omit it, and dropped when the original changes', async t => {
  const db = await store(t);
  const id = crypto.randomUUID();
  const first = await poems.createPoem(db, id, poems.validateInput(await withProvenance({ ...original, ...french })));
  // Wrong or missing provenance for a French text is refused.
  await assert.rejects(
    async () =>
      poems.updatePoem(
        db,
        id,
        first.revision,
        poems.validateInput({ ...original, ...french, fr_content: 'Autre texte' }),
      ),
    { status: 409 },
  );
  await assert.rejects(
    async () => poems.createPoem(db, crypto.randomUUID(), poems.validateInput({ ...original, fr_title: 'Titre' })),
    { status: 400 },
  );
  // An older client that does not know the French fields keeps them.
  const { translation_provenance } = await withProvenance(original);
  const kept = await poems.updatePoem(
    db,
    id,
    first.revision,
    poems.validateInput({ ...original, author: 'D. Enache', translation_provenance }),
  );
  assert.equal(kept.fr_title, 'La roue de fumée');
  assert.equal(kept.author, 'D. Enache');
  // A changed original without a new French version drops the old one (and the old translation).
  const changed = await poems.updatePoem(
    db,
    id,
    kept.revision,
    poems.validateInput({
      title: original.title,
      author: 'Dan Enache',
      theme: '',
      content: 'Alt text.',
      source_language: 'ro',
    }),
  );
  assert.equal(changed.fr_title, null);
  assert.equal(changed.fr_provenance, null);
  assert.equal(poemVersion(changed, 'fr'), null);
  // History keeps the French version.
  const history = await db
    .prepare('SELECT snapshot FROM content_history WHERE entity_id = ? AND revision = ?')
    .bind(id, first.revision)
    .first();
  assert.equal(JSON.parse(history.snapshot).fr_title, 'La roue de fumée');
  assert.equal(JSON.parse(history.snapshot).fr_provenance.origin, 'automatic');
});

test('a poem keeps French and German versions side by side, each checked on its own', async t => {
  const db = await store(t);
  const id = crypto.randomUUID();
  const german = {
    de_title: 'Das Rad aus Rauch',
    de_theme: 'Liebe',
    de_content: 'Ich bin gefangen im Rad des Lebens\nseit einer Weile.',
  };
  const both = { ...original, ...french, ...german };
  const input = {
    ...both,
    translation_provenance: await translationProvenance(both, 'manual'),
    fr_provenance: await translationProvenance(both, 'automatic', 'fr'),
    de_provenance: await translationProvenance(both, 'automatic', 'de'),
  };
  const saved = await poems.createPoem(db, id, poems.validateInput(input));
  assert.equal(saved.de_title, 'Das Rad aus Rauch');
  assert.equal(await translationStatus(saved, 'de'), 'ready');
  assert.equal(await translationStatus(saved, 'fr'), 'ready');
  assert.equal(poemVersion(saved, 'de').content, german.de_content);
  assert.equal(poemVersion(saved, 'fr').title, 'La roue de fumée');
  const card = (await listPoemCards(db, { lang: 'de' }, 'de')).poems[0];
  assert.deepEqual([card.title, card.theme, card.language], ['Das Rad aus Rauch', 'Liebe', 'de']);
  assert.equal((await listPoemCards(db, { lang: 'de', q: 'gefangen' }, 'de')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'de', theme: 'Liebe' }, 'de')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'de', translation: 'without' }, 'de')).total, 0);
  // A German provenance cannot vouch for a changed German text, and French is not affected.
  await assert.rejects(
    async () => poems.updatePoem(db, id, saved.revision, poems.validateInput({ ...input, de_content: 'Anderer Text' })),
    { status: 409, message: /germană/ },
  );
  const withoutGerman = await poems.updatePoem(
    db,
    id,
    saved.revision,
    poems.validateInput({ ...input, de_title: '', de_theme: '', de_content: '', de_provenance: null }),
  );
  assert.equal(withoutGerman.de_title, null);
  assert.equal(withoutGerman.fr_title, 'La roue de fumée');
  assert.equal(poemVersion(withoutGerman, 'de'), null);
  const history = await db
    .prepare('SELECT snapshot FROM content_history WHERE entity_id = ? AND revision = ?')
    .bind(id, saved.revision)
    .first();
  assert.equal(JSON.parse(history.snapshot).de_title, 'Das Rad aus Rauch');
});

test('a Spanish version sits beside the French and German ones', async t => {
  const db = await store(t);
  const id = crypto.randomUUID();
  const spanish = {
    es_title: 'La rueda de humo',
    es_theme: 'amor',
    es_content: 'Estoy atrapado en la rueda de la vida\ndesde hace un tiempo.',
  };
  const all = { ...original, ...french, ...spanish };
  const input = {
    ...all,
    translation_provenance: await translationProvenance(all, 'manual'),
    fr_provenance: await translationProvenance(all, 'automatic', 'fr'),
    es_provenance: await translationProvenance(all, 'automatic', 'es'),
  };
  const saved = await poems.createPoem(db, id, poems.validateInput(input));
  assert.equal(await translationStatus(saved, 'es'), 'ready');
  assert.equal(poemVersion(saved, 'es').title, 'La rueda de humo');
  assert.equal(poemVersion(saved, 'de'), null);
  const card = (await listPoemCards(db, { lang: 'es' }, 'es')).poems[0];
  assert.deepEqual([card.title, card.language], ['La rueda de humo', 'es']);
  assert.equal((await listPoemCards(db, { lang: 'es', q: 'atrapado' }, 'es')).total, 1);
  assert.equal((await listPoemCards(db, { lang: 'de', translation: 'without' }, 'de')).total, 1);
  await assert.rejects(
    async () => poems.updatePoem(db, id, saved.revision, poems.validateInput({ ...input, es_content: 'Otro texto' })),
    { status: 409, message: /spaniolă/ },
  );
});

test('an Italian version sits beside the others', async t => {
  const db = await store(t);
  const id = crypto.randomUUID();
  const italian = {
    it_title: 'La ruota di fumo',
    it_theme: 'amore',
    it_content: 'Sono prigioniero nella ruota della vita\nda un po’ di tempo.',
  };
  const all = { ...original, ...italian };
  const input = {
    ...all,
    translation_provenance: await translationProvenance(all, 'manual'),
    it_provenance: await translationProvenance(all, 'automatic', 'it'),
  };
  const saved = await poems.createPoem(db, id, poems.validateInput(input));
  assert.equal(await translationStatus(saved, 'it'), 'ready');
  assert.equal(poemVersion(saved, 'it').title, 'La ruota di fumo');
  const card = (await listPoemCards(db, { lang: 'it' }, 'it')).poems[0];
  assert.deepEqual([card.title, card.language], ['La ruota di fumo', 'it']);
  assert.equal((await listPoemCards(db, { lang: 'it', q: 'prigioniero' }, 'it')).total, 1);
  await assert.rejects(
    async () => poems.updatePoem(db, id, saved.revision, poems.validateInput({ ...input, it_content: 'Altro testo' })),
    { status: 409, message: /italiană/ },
  );
});
