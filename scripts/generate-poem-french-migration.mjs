// Writes drizzle/0024_poem_french.sql: the French columns (from drizzle-kit) and the poem triggers
// that must now include them (search index, search queue, editorial history). Run deliberately;
// `--check` verifies the committed file. The search fold is the one generated for 0018.
// Run with: node --experimental-strip-types scripts/generate-poem-french-migration.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { searchFoldMap } from '../lib/search-fold-map.ts';

const exports = {};
const code = ts.transpileModule(readFileSync(new URL('../lib/search-normalization.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'exports', code)(() => ({ searchFoldMap }), exports);
const fold = exports.sqlFoldSearch;

const searchColumns = [
  'title',
  'author',
  'theme',
  'content',
  'translated_title',
  'translated_theme',
  'translated_content',
  'fr_title',
  'fr_theme',
  'fr_content',
];
const french = ['fr_title', 'fr_theme', 'fr_content'];
const statements = [
  ...french.map(column => `ALTER TABLE \`poem_search\` ADD \`${column}\` text DEFAULT '' NOT NULL;`),
  ...['fr_title', 'fr_theme', 'fr_content', 'fr_provenance'].map(
    column => `ALTER TABLE \`poems\` ADD \`${column}\` text;`,
  ),
];
// FTS5 cannot add columns: recreate the trigram index over poem_search (0017) and rebuild it.
const fts = searchColumns.join(', ');
const row = prefix => searchColumns.map(column => `${prefix}.${column}`).join(', ');
statements.push(
  'DROP TRIGGER poem_search_fts_insert;',
  'DROP TRIGGER poem_search_fts_delete;',
  'DROP TRIGGER poem_search_fts_update;',
  'DROP TABLE poem_search_fts;',
  `CREATE VIRTUAL TABLE poem_search_fts USING fts5(${fts}, content='poem_search', content_rowid='rowid', tokenize='trigram case_sensitive 1');`,
  `CREATE TRIGGER poem_search_fts_insert AFTER INSERT ON poem_search BEGIN
  INSERT INTO poem_search_fts(rowid, ${fts}) VALUES (NEW.rowid, ${row('NEW')});
END;`,
  `CREATE TRIGGER poem_search_fts_delete AFTER DELETE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, ${fts}) VALUES ('delete', OLD.rowid, ${row('OLD')});
END;`,
  `CREATE TRIGGER poem_search_fts_update AFTER UPDATE ON poem_search BEGIN
  INSERT INTO poem_search_fts(poem_search_fts, rowid, ${fts}) VALUES ('delete', OLD.rowid, ${row('OLD')});
  INSERT INTO poem_search_fts(rowid, ${fts}) VALUES (NEW.rowid, ${row('NEW')});
END;`,
  "INSERT INTO poem_search_fts(poem_search_fts) VALUES ('rebuild');",
);
for (const event of ['insert', 'update']) {
  statements.push(`DROP TRIGGER poem_search_${event};`);
  statements.push(`CREATE TRIGGER poem_search_${event} AFTER ${event === 'insert' ? 'INSERT' : 'UPDATE OF ' + searchColumns.join(', ')} ON poems BEGIN
    INSERT INTO poem_search (poem_id, ${searchColumns.join(', ')}) VALUES (NEW.id, ${searchColumns.map(column => fold('NEW.' + column)).join(', ')})
    ON CONFLICT(poem_id) DO UPDATE SET ${searchColumns.map(column => `${column}=excluded.${column}`).join(', ')};
  END;`);
}
statements.push('DROP TRIGGER poem_search_pending_update;');
statements.push(`CREATE TRIGGER poem_search_pending_update AFTER UPDATE OF ${searchColumns.join(', ')} ON poems BEGIN
  INSERT INTO poem_search_pending(poem_id, token) VALUES (NEW.id, hex(randomblob(16)))
  ON CONFLICT(poem_id) DO UPDATE SET token=excluded.token;
END;`);
const snapshot = row =>
  `json_object('id', ${row}.id, 'title', ${row}.title, 'author', ${row}.author, 'theme', ${row}.theme, 'content', ${row}.content, 'revision', ${row}.revision, 'created_at', ${row}.created_at, 'updated_at', ${row}.updated_at, 'image_id', ${row}.image_id, 'source_language', ${row}.source_language, 'translated_title', ${row}.translated_title, 'translated_theme', ${row}.translated_theme, 'translated_content', ${row}.translated_content, 'audio_ro_id', ${row}.audio_ro_id, 'audio_en_id', ${row}.audio_en_id, 'translation_provenance', json(${row}.translation_provenance), 'fr_title', ${row}.fr_title, 'fr_theme', ${row}.fr_theme, 'fr_content', ${row}.fr_content, 'fr_provenance', json(${row}.fr_provenance))`;
for (const [event, row, kind] of [
  ['insert', 'NEW', 'saved'],
  ['update', 'NEW', 'saved'],
  ['delete', 'OLD', 'deleted'],
]) {
  statements.push(`DROP TRIGGER history_poem_${event};`);
  statements.push(`CREATE TRIGGER history_poem_${event} AFTER ${event.toUpperCase()} ON poems BEGIN
  INSERT INTO content_history (kind, entity_id, revision, event, title, snapshot, recorded_at) VALUES ('poem', ${row}.id, ${row}.revision, '${kind}', ${row}.title, ${snapshot(row)}, CAST(strftime('%s','now') AS INTEGER)*1000);
END;`);
}
const content = statements.join('\n--> statement-breakpoint\n') + '\n';
const target = new URL('../drizzle/0024_poem_french.sql', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content)
    throw new Error('drizzle/0024_poem_french.sql differs from its generator');
} else writeFileSync(target, content);
console.log(`0024_poem_french: ${statements.length} statements`);
