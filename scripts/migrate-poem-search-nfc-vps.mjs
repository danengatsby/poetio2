import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../server/vps-storage.mjs';
import { tsImport } from 'tsx/esm/api';

const sql = readFileSync(new URL('../drizzle/0020_poem_search_nfc.sql', import.meta.url), 'utf8');
const definitions = sql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.startsWith('CREATE'));
const normalized = sql => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');

export async function migratePoemSearchNfc(file) {
  if (!file || !existsSync(file)) throw new Error('Existing Poetio database required.');
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    if (!db.prepare("SELECT 1 FROM collection_meta WHERE key='search_normalization_v2'").get())
      throw new Error('Apply the existing search normalization migration first.');
    const existing = definitions.map(def =>
      db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(def.match(/^CREATE (?:TABLE|TRIGGER) (\w+)/)[1]),
    );
    if (existing.some(Boolean)) {
      if (existing.some((row, i) => !row || normalized(row.sql) !== normalized(definitions[i])))
        throw new Error('Unexpected poem search schema.');
    } else db.exec(sql);
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
  const { rebuildPendingPoemSearch } = await tsImport('../db/poem-search-index.ts', import.meta.url);
  const store = openDatabase(file);
  try {
    await rebuildPendingPoemSearch(store, true);
    await store.prepare("INSERT INTO poem_search_fts(poem_search_fts,rank) VALUES('integrity-check',1)").run();
  } finally {
    store.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migratePoemSearchNfc(process.argv[2]);
  console.log('Poem search index rebuilt and verified.');
}
