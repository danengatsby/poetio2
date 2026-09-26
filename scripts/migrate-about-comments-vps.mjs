import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migrateAboutCommentsDatabase(file) {
  if (!existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    if (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'about_comments'").get()) { db.exec('COMMIT'); return false; }
    db.exec(readFileSync(new URL('../drizzle/0005_about_comments.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key verification failed.');
    db.exec('COMMIT');
    return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/migrate-about-comments-vps.mjs /path/to/poetio.sqlite3');
  console.log(migrateAboutCommentsDatabase(process.argv[2]) ? 'About comments migration applied.' : 'About comments migration already applied.');
}
