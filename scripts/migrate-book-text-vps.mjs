import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migrateBookText(file) {
  if (!file || !existsSync(file)) throw new Error('An existing Poetio database is required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='book_page_texts'").get();
    if (existing) {
      const columns = db.prepare('PRAGMA table_info(book_page_texts)').all();
      if (columns.map(column => column.name).join(',') !== 'file_id,page,content,language,revision,updated_at' || columns[0].pk !== 1 || columns[1].pk !== 2) throw new Error('Unexpected book_page_texts schema; review before deployment.');
      db.exec('COMMIT'); return false;
    }
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='book_files'").get()) throw new Error('Apply the book collection migration first.');
    db.exec(readFileSync(new URL('../drizzle/0012_book_page_texts.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateBookText(process.argv[2]) ? 'Book text migration applied.' : 'Book text migration already applied.');
