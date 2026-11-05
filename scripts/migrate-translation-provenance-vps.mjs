import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../drizzle/0015_translation_provenance.sql', import.meta.url), 'utf8');
const previous = readFileSync(new URL('../drizzle/0011_editorial_recovery.sql', import.meta.url), 'utf8');
const normalized = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
function checkTriggers(db, sql) {
  for (const statement of sql.match(/CREATE TRIGGER history_poem_[\s\S]*?\nEND;/g) || []) {
    const name = statement.match(/CREATE TRIGGER (\w+)/)[1];
    const actual = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=? AND tbl_name='poems'").get(name);
    if (!actual || normalized(actual.sql) !== normalized(statement)) throw new Error('Partial or unexpected poem history schema; review before deployment.');
  }
}

export function migrateTranslationProvenance(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const column = db.prepare("PRAGMA table_info('poems')").all().find(row => row.name === 'translation_provenance');
    if (column) {
      if (column.type.toLowerCase() !== 'text' || column.notnull || column.pk || column.dflt_value !== null) throw new Error('Unexpected translation provenance column.');
      checkTriggers(db, migration);
      db.exec('COMMIT'); return false;
    }
    checkTriggers(db, previous);
    db.exec(migration);
    checkTriggers(db, migration);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateTranslationProvenance(process.argv[2]) ? 'Translation provenance applied.' : 'Translation provenance already applied.');
