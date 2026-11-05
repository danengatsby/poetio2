import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../drizzle/0016_book_text_recovery.sql', import.meta.url), 'utf8');
const objects = [migration.split(';')[0], ...(migration.match(/CREATE TRIGGER history_book_text_[\s\S]*?\nEND;/g) || [])];
const normalized = value => value.replace(/\s+/g, ' ').trim().replace(/;$/, '');
export function migrateBookTextRecovery(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const found = objects.map(sql => {
      const name = sql.match(/CREATE (?:INDEX|TRIGGER) (\w+)/)[1];
      return db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name);
    });
    if (found.some(Boolean)) {
      if (found.some((item, index) => !item || normalized(item.sql) !== normalized(objects[index]))) throw new Error('Partial or unexpected text recovery schema.');
      db.exec('COMMIT'); return false;
    }
    if (db.prepare("SELECT id FROM content_history WHERE kind='book-text' LIMIT 1").get()) throw new Error('Partial text recovery migration; history already exists.');
    if (db.prepare("PRAGMA table_info('book_page_texts')").all().map(row => row.name).join(',') !== 'file_id,page,content,language,revision,updated_at') throw new Error('Apply the book text migration first.');
    db.exec(migration);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateBookTextRecovery(process.argv[2]) ? 'Book text recovery applied.' : 'Book text recovery already applied.');
