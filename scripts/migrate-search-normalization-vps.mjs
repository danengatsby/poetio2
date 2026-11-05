import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../drizzle/0018_search_normalization.sql', import.meta.url), 'utf8');
const definitions = migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(sql => /^CREATE /.test(sql));
const normalized = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
const mapping = JSON.parse(readFileSync(new URL('../lib/search-fold-map.ts', import.meta.url), 'utf8').match(/= ([\s\S]+);/)[1]);

export function migrateSearchNormalization(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    if (db.prepare("SELECT value FROM collection_meta WHERE key='search_normalization_v2'").get()) {
      for (const sql of definitions) {
        const name = sql.match(/^CREATE (?:TABLE|TRIGGER) [`"]?(\w+)/)[1];
        const found = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name);
        if (!found || normalized(found.sql) !== normalized(sql)) throw new Error('Partial or unexpected normalization schema.');
      }
      const rows = Object.fromEntries(db.prepare('SELECT letter, replacement FROM search_fold_characters ORDER BY letter').all().map(row => [row.letter, row.replacement]));
      if (Object.keys(rows).length !== Object.keys(mapping).length || Object.entries(mapping).some(([key, value]) => rows[key] !== value)) throw new Error('Unexpected normalization mapping.');
      db.exec('COMMIT'); return false;
    }
    if (db.prepare("SELECT name FROM sqlite_master WHERE name='search_fold_characters'").get()) throw new Error('Partial normalization schema.');
    db.exec(migration);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    for (const name of ['poem_search_fts', 'book_search_fts']) db.exec(`INSERT INTO ${name}(${name}, rank) VALUES('integrity-check', 1)`);
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateSearchNormalization(process.argv[2]) ? 'Search normalization applied.' : 'Search normalization already applied.');
