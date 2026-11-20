// Applies drizzle/*.sql in order and records each file in `schema_migrations`.
//
//   node scripts/migrate.mjs status /var/lib/poetio/poetio.sqlite3
//   node scripts/migrate.mjs apply  /var/lib/poetio/poetio.sqlite3 [--create] [--baseline <name>]
//
// A database created before this runner has no ledger. On the first `apply`, its
// schema is compared with the schema each prefix of the migrations produces on an
// empty database; the matching prefix is recorded as applied without running it
// again. Anything else stops before writing, so an unexpected schema is reviewed
// by a person instead of being "repaired".
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LEDGER = 'schema_migrations';
// SQLite internals, Cloudflare D1 bookkeeping and the ledger itself are not part
// of the application schema.
const IGNORED = /^(sqlite_|_cf_|d1_)|^schema_migrations$/;
const DEFAULT_DIRECTORY = fileURLToPath(new URL('../drizzle/', import.meta.url));

// Data steps that must follow a migration's SQL. Each one is idempotent: if it
// fails, the SQL stays committed and the next run repeats only this step.
export const defaultHooks = {
  '0020_poem_search_nfc': async file => (await import('./migrations/0020_poem_search_nfc.mjs')).default(file),
};

export function listMigrations(directory = DEFAULT_DIRECTORY) {
  return readdirSync(directory)
    .filter(file => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map(file => {
      const sql = readFileSync(join(directory, file), 'utf8');
      return { name: file.slice(0, -4), sql, sha256: createHash('sha256').update(sql).digest('hex') };
    });
}

export function schemaOf(db) {
  return db
    .prepare('SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name')
    .all()
    .filter(row => !IGNORED.test(row.name) && !IGNORED.test(row.tbl_name))
    .map(row => `${row.type} ${row.name} ${row.tbl_name}: ${row.sql.replace(/\s+/g, ' ').trim()}`);
}

/** Schema after each prefix of the migrations; index 0 is the empty database. */
export function expectedSchemas(migrations) {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON;');
    const schemas = [schemaOf(db).join('\n')];
    for (const migration of migrations) {
      try {
        db.exec(migration.sql);
      } catch (error) {
        throw new Error(`${migration.name} fails on an empty database: ${error.message}`, { cause: error });
      }
      schemas.push(schemaOf(db).join('\n'));
    }
    return schemas;
  } finally {
    db.close();
  }
}

const hasLedger = db => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(LEDGER));
const now = () => new Date().toISOString();

function describeDifference(actual, expected) {
  const have = new Set(actual.split('\n').filter(Boolean));
  const want = new Set(expected.split('\n').filter(Boolean));
  const missing = [...want].filter(line => !have.has(line)).map(line => '  missing    ' + line.slice(0, 160));
  const unexpected = [...have].filter(line => !want.has(line)).map(line => '  unexpected ' + line.slice(0, 160));
  return [...missing, ...unexpected].slice(0, 20).join('\n');
}

/** Which prefix of the migrations this ledger-less schema corresponds to. */
export function findBaseline(db, migrations, requested) {
  const current = schemaOf(db).join('\n');
  // A new database starts before the first migration; nothing to compare.
  if (!current && !requested) return 0;
  const schemas = expectedSchemas(migrations);
  if (requested) {
    const index = migrations.findIndex(migration => migration.name === requested);
    if (index === -1) throw new Error(`Unknown baseline migration ${requested}.`);
    if (schemas[index + 1] !== current)
      throw new Error(`The schema does not match ${requested}:\n${describeDifference(current, schemas[index + 1])}`);
    return index + 1;
  }
  const matches = schemas.flatMap((schema, count) => (schema === current ? [count] : []));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1)
    throw new Error(
      `The schema matches several migration states (${matches
        .map(count => (count ? migrations[count - 1].name : 'empty'))
        .join(', ')}). Choose one with --baseline <name>.`,
    );
  throw new Error(
    `The schema matches no migration state; review it before migrating. Compared with the latest:\n` +
      describeDifference(current, schemas.at(-1)),
  );
}

function readLedger(db, migrations) {
  const rows = db.prepare(`SELECT name, sha256, applied_at, completed_at FROM ${LEDGER} ORDER BY name`).all();
  rows.forEach((row, index) => {
    const migration = migrations[index];
    if (!migration || migration.name !== row.name)
      throw new Error(`The ledger records ${row.name} out of order or without a file in drizzle/.`);
    if (migration.sha256 !== row.sha256)
      throw new Error(`drizzle/${row.name}.sql changed after it was applied to this database.`);
  });
  return rows;
}

export function status(file, { directory } = {}) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const migrations = listMigrations(directory);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (!hasLedger(db)) {
      const count = findBaseline(db, migrations);
      return {
        ledger: false,
        baseline: count ? migrations[count - 1].name : null,
        pending: migrations.slice(count).map(migration => migration.name),
      };
    }
    const rows = readLedger(db, migrations);
    return {
      ledger: true,
      applied: rows.length,
      latest: rows.at(-1)?.name ?? null,
      incomplete: rows.filter(row => !row.completed_at).map(row => row.name),
      pending: migrations.slice(rows.length).map(migration => migration.name),
    };
  } finally {
    db.close();
  }
}

export async function migrate(file, { directory, hooks = defaultHooks, create = false, baseline } = {}) {
  if (!file || (!create && !existsSync(file))) throw new Error('Existing Poetio database required.');
  const migrations = listMigrations(directory);
  const result = { baseline: null, applied: [], completed: [] };
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    if (!hasLedger(db)) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const count = findBaseline(db, migrations, baseline);
        db.exec(`CREATE TABLE ${LEDGER} (
          name TEXT PRIMARY KEY NOT NULL,
          sha256 TEXT NOT NULL,
          applied_at TEXT NOT NULL,
          completed_at TEXT
        )`);
        const record = db.prepare(`INSERT INTO ${LEDGER} VALUES (?, ?, ?, ?)`);
        const at = now();
        for (const migration of migrations.slice(0, count)) record.run(migration.name, migration.sha256, at, at);
        db.exec('COMMIT');
        result.baseline = count ? migrations[count - 1].name : null;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    }

    const recorded = new Map(readLedger(db, migrations).map(row => [row.name, row]));
    for (const migration of migrations) {
      if (!recorded.has(migration.name)) {
        db.exec('BEGIN IMMEDIATE');
        try {
          db.exec(migration.sql);
          if (db.prepare('PRAGMA foreign_key_check').all().length)
            throw new Error(`Foreign key check failed after ${migration.name}.`);
          db.prepare(`INSERT INTO ${LEDGER} VALUES (?, ?, ?, NULL)`).run(migration.name, migration.sha256, now());
          db.exec('COMMIT');
        } catch (error) {
          if (db.isTransaction) db.exec('ROLLBACK');
          throw new Error(`${migration.name}: ${error.message}`, { cause: error });
        }
        result.applied.push(migration.name);
      } else if (recorded.get(migration.name).completed_at) continue;

      await hooks[migration.name]?.(file);
      db.prepare(`UPDATE ${LEDGER} SET completed_at = ? WHERE name = ?`).run(now(), migration.name);
      result.completed.push(migration.name);
    }

    if (result.applied.length || result.completed.length) {
      const integrity = db.prepare('PRAGMA integrity_check').all();
      if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok')
        throw new Error('SQLite integrity check failed after migrating.');
      for (const table of ['poem_search_fts', 'book_search_fts'])
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
          db.exec(`INSERT INTO ${table}(${table}, rank) VALUES('integrity-check', 1)`);
    }
    return result;
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, ...options] = process.argv.slice(2);
  const option = name => {
    const index = options.indexOf(name);
    return index === -1 ? undefined : options[index + 1];
  };
  if (command === 'status') console.log(JSON.stringify(status(file), null, 2));
  else if (command === 'apply')
    console.log(
      JSON.stringify(
        await migrate(file, { create: options.includes('--create'), baseline: option('--baseline') }),
        null,
        2,
      ),
    );
  else {
    console.error('Usage: node scripts/migrate.mjs status|apply <database> [--create] [--baseline <name>]');
    process.exit(64);
  }
}
