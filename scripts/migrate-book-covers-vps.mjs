import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const migration = readFileSync(new URL('../drizzle/0019_book_purchase_covers.sql', import.meta.url), 'utf8');
const definitions = migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(sql => /^CREATE /.test(sql));
const normalized = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');

export function migrateBookCovers(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
    const columns = db.prepare('PRAGMA table_info(books)').all().filter(row => ['image_2_id', 'purchase_url_1', 'purchase_url_2'].includes(row.name));
    const marker = db.prepare("SELECT value FROM collection_meta WHERE key='book_purchase_covers_v1'").get();
    if (columns.length || marker) {
      if (columns.length !== 3 || marker?.value !== 'complete' || columns.some(row => row.type.toLowerCase() !== 'text' || row.notnull || row.dflt_value !== null)) throw new Error('Partial or unexpected book covers schema.');
      for (const sql of definitions) {
        const name = sql.match(/^CREATE (?:TRIGGER|INDEX) (\w+)/)[1];
        const saved = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(name);
        if (!saved || normalized(saved.sql) !== normalized(sql)) throw new Error('Partial or unexpected book covers schema.');
      }
      if (!db.prepare('PRAGMA foreign_key_list(books)').all().some(row => row.from === 'image_2_id' && row.table === 'poem_images' && row.to === 'id')) throw new Error('Missing second cover foreign key.');
      db.exec('COMMIT'); return false;
    }
    db.exec(migration);
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key check failed.');
    db.exec('COMMIT'); return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(migrateBookCovers(process.argv[2]) ? 'Book purchase covers applied.' : 'Book purchase covers already applied.');
