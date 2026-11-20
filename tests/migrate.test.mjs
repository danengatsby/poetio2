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
  return { calls, hooks: { [latest]: async file => calls.push(file) } };
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
  assert.deepEqual(status(file), { ledger: true, applied: migrations.length, latest, incomplete: [], pending: [] });
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
  assert.deepEqual(result.applied, ['0019_book_purchase_covers', latest]);
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
  await assert.rejects(migrate(file, { baseline: latest }), /does not match 0020_poem_search_nfc/);
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
    /0020_poem_search_nfc\.sql changed after it was applied/,
  );
  assert.throws(() => status(file, { directory }), /changed after it was applied/);
});

test('rolls back a failing migration and leaves it pending', async t => {
  const directory = workspace(t);
  cpSync(fileURLToPath(new URL('../drizzle/', import.meta.url)), directory, { recursive: true });
  writeFileSync(
    join(directory, '0021_broken.sql'),
    'CREATE TABLE half_done (value TEXT);\nINSERT INTO missing VALUES (1);\n',
  );
  const file = join(directory, 'poetio.sqlite3');
  await assert.rejects(migrate(file, { directory, create: true, hooks: {} }), /0021_broken: no such table: missing/);
  assert.deepEqual(read(file, "SELECT name FROM sqlite_master WHERE name = 'half_done'"), []);
  assert.deepEqual(status(file, { directory }).pending, ['0021_broken']);
});

test('repeats only the data step after it failed', async t => {
  const file = legacyDatabase(t, '0020');
  await assert.rejects(
    migrate(file, {
      hooks: {
        [latest]: async () => {
          throw new Error('index rebuild interrupted');
        },
      },
    }),
    /index rebuild interrupted/,
  );
  assert.deepEqual(status(file).incomplete, [latest]);
  const { calls, hooks } = countingHooks();
  assert.deepEqual(await migrate(file, { hooks }), { baseline: null, applied: [], completed: [latest] });
  assert.equal(calls.length, 1);
  assert.deepEqual(status(file).incomplete, []);
});
