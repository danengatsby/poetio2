import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../drizzle/0017_search_indexes.sql', import.meta.url), 'utf8');
const definitions = migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(sql => /^CREATE /.test(sql));
const normalized = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');

export function migrateSearch(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const found = definitions.map(sql => db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(sql.match(/^CREATE (?:VIRTUAL TABLE|TABLE|TRIGGER|INDEX) [`"]?(\w+)/)[1]));
    if (found.some(Boolean)) {
      if (found.some((item, index) => !item || normalized(item.sql) !== normalized(definitions[index]))) throw new Error('Partial or unexpected search schema; review before deployment.');
      db.exec('COMMIT'); return false;
    }
    db.exec(migration);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    for (const name of ['poem_search_fts', 'book_search_fts']) db.exec(`INSERT INTO ${name}(${name}, rank) VALUES('integrity-check', 1)`);
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateSearch(process.argv[2]) ? 'Search indexes applied.' : 'Search indexes already applied.');
