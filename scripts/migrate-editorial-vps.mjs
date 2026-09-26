import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function migrateEditorial(file) {
  if (!existsSync(file)) throw new Error('Existing database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('content_drafts','content_history')").all();
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('history_poem_insert','history_poem_update','history_poem_delete','history_video_insert','history_video_update','history_video_delete')").all();
    if (table.length === 2 && triggers.length === 6) { db.exec('COMMIT'); return false; }
    if (table.length || triggers.length) throw new Error('Partial editorial migration; review schema.');
    db.exec(readFileSync(new URL('../drizzle/0011_editorial_recovery.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateEditorial(process.argv[2]) ? 'Editorial migration applied.' : 'Editorial migration already applied.');
