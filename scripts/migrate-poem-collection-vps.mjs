import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function migratePoemCollection(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const existing = db.prepare("SELECT tbl_name FROM sqlite_master WHERE type='index' AND name='idx_poems_collection_order'").get();
    if (existing) {
      const columns = db.prepare("PRAGMA index_info('idx_poems_collection_order')").all();
      const index = db.prepare("PRAGMA index_list('poems')").all().find(row => row.name === 'idx_poems_collection_order');
      if (existing.tbl_name !== 'poems' || columns.map(column => column.name).join(',') !== 'created_at,id' || index?.unique !== 0 || index?.partial !== 0) throw new Error('Unexpected collection index; review before deployment.');
      db.exec('COMMIT'); return false;
    }
    db.exec(readFileSync(new URL('../drizzle/0014_poem_collection_order.sql', import.meta.url), 'utf8'));
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migratePoemCollection(process.argv[2]) ? 'Poem collection index applied.' : 'Poem collection index already applied.');
