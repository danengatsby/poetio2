// Writes the migrations that give poems their own version in another language: 0024 (French,
// fr_*), 0025 (German, de_*), 0026 (Spanish, es_*) and 0027 (Italian, it_*). Each adds the columns (as drizzle-kit generates them) and recreates
// the poem triggers that must include them: search index (and its FTS5 table), search queue and
// editorial history. Run deliberately; `--check` verifies the committed files. The search fold is
// the one generated for 0018.
// Run with: node --experimental-strip-types scripts/generate-poem-language-migrations.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { searchFoldMap } from '../lib/search-fold-map.ts';

const exports = {};
const code = ts.transpileModule(readFileSync(new URL('../lib/search-normalization.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('require', 'exports', code)(() => ({ searchFoldMap }), exports);
const fold = exports.sqlFoldSearch;

const baseColumns = [
  'title',
  'author',
  'theme',
  'content',
  'translated_title',
  'translated_theme',
  'translated_content',
];
const versionColumns = language => [`${language}_title`, `${language}_theme`, `${language}_content`];

/** The migration adding `language`, after the versions in `before` (in order). */
function migration(language, before) {
  const searchColumns = [...baseColumns, ...[...before, language].flatMap(versionColumns)];
  const statements = [
    ...versionColumns(language).map(
      column => `ALTER TABLE \`poem_search\` ADD \`${column}\` text DEFAULT '' NOT NULL;`,
    ),
    ...[...versionColumns(language), `${language}_provenance`].map(
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
  const versions = row =>
    [...before, language]
      .map(
        code =>
          `'${code}_title', ${row}.${code}_title, '${code}_theme', ${row}.${code}_theme, '${code}_content', ${row}.${code}_content, '${code}_provenance', json(${row}.${code}_provenance)`,
      )
      .join(', ');
  const snapshot = row =>
    `json_object('id', ${row}.id, 'title', ${row}.title, 'author', ${row}.author, 'theme', ${row}.theme, 'content', ${row}.content, 'revision', ${row}.revision, 'created_at', ${row}.created_at, 'updated_at', ${row}.updated_at, 'image_id', ${row}.image_id, 'source_language', ${row}.source_language, 'translated_title', ${row}.translated_title, 'translated_theme', ${row}.translated_theme, 'translated_content', ${row}.translated_content, 'audio_ro_id', ${row}.audio_ro_id, 'audio_en_id', ${row}.audio_en_id, 'translation_provenance', json(${row}.translation_provenance), ${versions(row)})`;
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
  return statements.join('\n--> statement-breakpoint\n') + '\n';
}

for (const [file, language, before] of [
  ['0024_poem_french.sql', 'fr', []],
  ['0025_poem_german.sql', 'de', ['fr']],
  ['0026_poem_spanish.sql', 'es', ['fr', 'de']],
  ['0027_poem_italian.sql', 'it', ['fr', 'de', 'es']],
]) {
  const target = new URL('../drizzle/' + file, import.meta.url);
  const content = migration(language, before);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== content) throw new Error(`drizzle/${file} differs from its generator`);
  } else writeFileSync(target, content);
  console.log(`${file}: ${content.split('--> statement-breakpoint').length} statements`);
}
