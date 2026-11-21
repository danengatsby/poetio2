import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { expectedSchemas, listMigrations, migrate, schemaOf, status } from '../scripts/migrate.mjs';

const migrations = listMigrations();
const latest = migrations.at(-1).name;
// The migration with a data step (see defaultHooks in scripts/migrate.mjs).
const HOOKED = '0020_poem_search_nfc';
const from = prefix => migrations.filter(migration => migration.name >= prefix).map(migration => migration.name);

function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-migrate-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

/** A database migrated the way production was before the ledger existed. */
function legacyDatabase(t, before = '9999') {
  const file = join(workspace(t), 'poetio.sqlite3');
  const db = new DatabaseSync(file);
  for (const migration of migrations.filter(migration => migration.name < before)) db.exec(migration.sql);
  db.close();
  return file;
}

const read = (file, sql) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
};
const countingHooks = () => {
  const calls = [];
  return { calls, hooks: { [HOOKED]: async file => calls.push(file) } };
};

test('creates a database, applies every migration with its data step, then does nothing', async t => {
  const file = join(workspace(t), 'poetio.sqlite3');
  const first = await migrate(file, { create: true });
  assert.equal(first.baseline, null);
  assert.deepEqual(
    first.applied,
    migrations.map(migration => migration.name),
  );
  assert.deepEqual(first.completed, first.applied);

  const db = new DatabaseSync(file, { readOnly: true });
  assert.equal(schemaOf(db).join('\n'), expectedSchemas(migrations).at(-1));
  db.close();

  assert.deepEqual(await migrate(file), { baseline: null, applied: [], completed: [] });
  assert.deepEqual(status(file), {
    ledger: true,
    applied: migrations.length,
    latest,
    schema_matches: true,
    incomplete: [],
    pending: [],
  });
});

test('records a database migrated before the ledger existed without running anything', async t => {
  const file = legacyDatabase(t);
  assert.deepEqual(status(file), { ledger: false, baseline: latest, pending: [] });
  const { calls, hooks } = countingHooks();
  assert.deepEqual(await migrate(file, { hooks }), { baseline: latest, applied: [], completed: [] });
  assert.equal(calls.length, 0);
  const rows = read(file, 'SELECT name, sha256, completed_at FROM schema_migrations ORDER BY name');
  assert.deepEqual(
    rows.map(row => [row.name, row.sha256]),
    migrations.map(migration => [migration.name, migration.sha256]),
  );
  assert.ok(rows.every(row => row.completed_at));
});

test('records an older schema and applies the remaining migrations', async t => {
  const file = legacyDatabase(t, '0019');
  const { calls, hooks } = countingHooks();
  const result = await migrate(file, { hooks });
  assert.equal(result.baseline, '0018_search_normalization');
  assert.deepEqual(result.applied, from('0019'));
  assert.deepEqual(result.completed, result.applied);
  assert.deepEqual(calls, [file]);
});

test('refuses a schema that matches no migration state, before writing', async t => {
  const file = legacyDatabase(t);
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE stray (value TEXT)');
  db.close();
  await assert.rejects(migrate(file), /matches no migration state[\s\S]*unexpected table stray/);
  assert.deepEqual(read(file, "SELECT name FROM sqlite_master WHERE name = 'schema_migrations'"), []);
});

test('accepts an explicit baseline only when the schema matches it', async t => {
  const file = legacyDatabase(t, '0019');
  await assert.rejects(migrate(file, { baseline: latest }), new RegExp(`does not match ${latest}`));
  const result = await migrate(file, { baseline: '0018_search_normalization', hooks: countingHooks().hooks });
  assert.equal(result.baseline, '0018_search_normalization');
});

test('refuses a migration file that changed after it was applied', async t => {
  const directory = workspace(t);
  cpSync(fileURLToPath(new URL('../drizzle/', import.meta.url)), directory, { recursive: true });
  const file = join(directory, 'poetio.sqlite3');
  await migrate(file, { directory, create: true, hooks: {} });
  appendFileSync(join(directory, latest + '.sql'), '\n-- edited later\n');
  await assert.rejects(
    migrate(file, { directory, hooks: {} }),
    new RegExp(`${latest}\\.sql changed after it was applied`),
  );
  assert.throws(() => status(file, { directory }), /changed after it was applied/);
});

test('rolls back a failing migration and leaves it pending', async t => {
  const directory = workspace(t);
  cpSync(fileURLToPath(new URL('../drizzle/', import.meta.url)), directory, { recursive: true });
  writeFileSync(
    join(directory, '9999_broken.sql'),
    'CREATE TABLE half_done (value TEXT);\nINSERT INTO missing VALUES (1);\n',
  );
  const file = join(directory, 'poetio.sqlite3');
  await assert.rejects(migrate(file, { directory, create: true, hooks: {} }), /9999_broken: no such table: missing/);
  assert.deepEqual(read(file, "SELECT name FROM sqlite_master WHERE name = 'half_done'"), []);
  assert.deepEqual(status(file, { directory }).pending, ['9999_broken']);
});

test('repeats only the data step after it failed', async t => {
  const file = legacyDatabase(t, '0020');
  await assert.rejects(
    migrate(file, {
      hooks: {
        [HOOKED]: async () => {
          throw new Error('index rebuild interrupted');
        },
      },
    }),
    /index rebuild interrupted/,
  );
  assert.deepEqual(status(file).incomplete, [HOOKED]);
  const { calls, hooks } = countingHooks();
  const rerun = await migrate(file, { hooks });
  assert.deepEqual(rerun.applied, from(HOOKED).slice(1));
  assert.equal(rerun.completed[0], HOOKED);
  assert.equal(calls.length, 1);
  assert.deepEqual(status(file).incomplete, []);
});

test('stops at a target migration and continues from there later', async t => {
  const file = legacyDatabase(t, '0010');
  const { calls, hooks } = countingHooks();
  const first = await migrate(file, { target: '0012_book_page_texts', hooks });
  assert.equal(first.baseline, '0009_book_comments');
  assert.deepEqual(first.applied, ['0010_comment_moderation', '0011_editorial_recovery', '0012_book_page_texts']);
  assert.deepEqual(status(file).pending[0], '0013_book_editorial_recovery');
  assert.deepEqual((await migrate(file, { target: '0012_book_page_texts', hooks })).applied, []);
  const rest = await migrate(file, { hooks });
  assert.equal(rest.applied.at(-1), latest);
  assert.equal(calls.length, 1);
  await assert.rejects(migrate(file, { target: '9999_missing' }), /Unknown target migration/);
});

test('refuses to continue when the schema was changed by hand after migrating', async t => {
  const file = legacyDatabase(t, '0019');
  const { hooks } = countingHooks();
  await migrate(file, { target: '0018_search_normalization', hooks });
  const db = new DatabaseSync(file);
  db.exec('DROP TRIGGER poem_search_update');
  db.close();
  assert.equal(status(file).schema_matches, false);
  await assert.rejects(
    migrate(file, { hooks }),
    /does not match the recorded migrations \(up to 0018_search_normalization\)[\s\S]*missing    trigger poem_search_update/,
  );
  assert.deepEqual(status(file).pending, from('0019'));
});
