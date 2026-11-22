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
