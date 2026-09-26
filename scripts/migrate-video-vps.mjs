import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migrateVideoDatabase(file) {
  if (!existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('videos', 'video_files')").all();
    if (tables.length === 2) { db.exec('COMMIT'); return false; }
    if (tables.length) throw new Error('Incomplete video schema; review before migrating.');
    db.exec(readFileSync(new URL('../drizzle/0006_video_collection.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key verification failed.');
    db.exec('COMMIT');
    return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/migrate-video-vps.mjs /path/to/poetio.sqlite3');
  console.log(migrateVideoDatabase(process.argv[2]) ? 'Video migration applied.' : 'Video migration already applied.');
}
