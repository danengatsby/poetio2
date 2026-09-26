import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migrateCommentModeration(file) {
  if (!existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    const tables = ['poem_comments', 'about_comments', 'video_comments', 'book_comments'];
    const columns = tables.map(table => db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
    const complete = columns.every(names => ['status', 'revision', 'moderated_at'].every(name => names.includes(name)));
    if (complete) { db.exec('COMMIT'); return false; }
    if (columns.some(names => names.includes('status') || names.includes('revision') || names.includes('moderated_at'))) throw new Error('Incomplete moderation schema; review before migration.');
    db.exec(readFileSync(new URL('../drizzle/0010_comment_moderation.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key verification failed.');
    db.exec('COMMIT');
    return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/migrate-comment-moderation-vps.mjs /path/to/poetio.sqlite3');
  console.log(migrateCommentModeration(process.argv[2]) ? 'Comment moderation migration applied.' : 'Comment moderation already applied.');
}
