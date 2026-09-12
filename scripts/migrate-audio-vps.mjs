import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Run after a SQLite backup, with poetio.service stopped. The old application
// remains compatible with this additive migration if a build is rolled back.
export function migrateAudioDatabase(file) {
  if (!existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;');
    const columns = db.prepare('PRAGMA table_info(poems)').all().map(column => column.name);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'poem_audio'").get();
    const audioColumns = columns.filter(name => ['audio_ro_id', 'audio_en_id'].includes(name));
    if (table && audioColumns.length === 2) { db.exec('COMMIT'); return false; }
    if (table || audioColumns.length || !columns.includes('image_id') || !columns.includes('source_language')) throw new Error('Unexpected schema; review the database before applying the audio migration.');
    db.exec(readFileSync(new URL('../drizzle/0003_uploaded_audio.sql', import.meta.url), 'utf8'));
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Foreign key verification failed.');
    db.exec('COMMIT');
    return true;
  } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/migrate-audio-vps.mjs /path/to/poetio.sqlite3');
  console.log(migrateAudioDatabase(process.argv[2]) ? 'Audio migration applied.' : 'Audio migration already applied.');
}
