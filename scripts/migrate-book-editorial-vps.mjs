import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migrateBookEditorial(file) {
  if (!file || !existsSync(file)) throw new Error('An existing Poetio database is required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('history_book_insert','history_book_update','history_book_delete')").all();
    if (triggers.length === 3) { db.exec('COMMIT'); return false; }
    if (triggers.length || db.prepare("SELECT id FROM content_history WHERE kind='book' LIMIT 1").get()) throw new Error('Partial book editorial migration; review schema and history.');
    db.exec(readFileSync(new URL('../drizzle/0013_book_editorial_recovery.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateBookEditorial(process.argv[2]) ? 'Book editorial migration applied.' : 'Book editorial migration already applied.');
