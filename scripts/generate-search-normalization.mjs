// Run deliberately when changing normalization, never during a production build.
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const romanian = { Ă: 'a', ă: 'a', Â: 'a', â: 'a', Î: 'i', î: 'i', Ș: 's', ș: 's', Ş: 's', ş: 's', Ț: 't', ț: 't', Ţ: 't', ţ: 't' };
const map = {};
for (let point = 128; point <= 0x10ffff; point++) {
  const letter = String.fromCodePoint(point), replacement = romanian[letter] ?? letter.toLowerCase();
  if (replacement !== letter) map[letter] = replacement;
}
const generated = `// Generated with Node Unicode ${process.versions.unicode}; regenerate with scripts/generate-search-normalization.mjs.\nexport const searchFoldMap: Record<string, string> = ${JSON.stringify(map, null, 2)};\n`;
const exports = {};
const code = ts.transpileModule(readFileSync(new URL('../lib/search-normalization.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require', 'exports', code)(() => ({ searchFoldMap: map }), exports);
const fold = exports.sqlFoldSearch;
const quote = text => "'" + text.replaceAll("'", "''") + "'";
const columns = ['title', 'author', 'theme', 'content', 'translated_title', 'translated_theme', 'translated_content'];
const statements = [
  'CREATE TABLE search_fold_characters (letter text PRIMARY KEY NOT NULL, replacement text NOT NULL);',
  'INSERT INTO search_fold_characters (letter, replacement) VALUES\n' + Object.entries(map).map(([letter, replacement]) => `(${quote(letter)}, ${quote(replacement)})`).join(',\n') + ';',
];
for (const event of ['insert', 'update']) {
  statements.push(`DROP TRIGGER poem_search_${event};`);
  statements.push(`CREATE TRIGGER poem_search_${event} AFTER ${event === 'insert' ? 'INSERT' : 'UPDATE OF ' + columns.join(', ')} ON poems BEGIN
    INSERT INTO poem_search (poem_id, ${columns.join(', ')}) VALUES (NEW.id, ${columns.map(column => fold('NEW.' + column)).join(', ')})
    ON CONFLICT(poem_id) DO UPDATE SET ${columns.map(column => `${column}=excluded.${column}`).join(', ')};
  END;`);
  statements.push(`DROP TRIGGER book_search_text_${event};`);
  statements.push(`CREATE TRIGGER book_search_text_${event} AFTER ${event.toUpperCase()} ON book_page_texts BEGIN
    INSERT INTO book_search_pages (file_id, page, content, search_text, source, revision)
    VALUES (NEW.file_id, NEW.page, NEW.content, ${fold('NEW.content')}, 'edited', NEW.revision)
    ON CONFLICT(file_id, page) DO UPDATE SET content=excluded.content, search_text=excluded.search_text, source='edited', revision=excluded.revision;
  END;`);
}
statements.push(`UPDATE poem_search SET ${columns.map(column => `${column}=(SELECT ${fold('poems.' + column)} FROM poems WHERE poems.id=poem_search.poem_id)`).join(', ')};`);
statements.push(`UPDATE book_search_pages SET search_text=${fold('content')};`);
statements.push("INSERT INTO collection_meta (key, value) VALUES ('search_normalization_v2', 'complete');");
for (const [path, content] of [['../lib/search-fold-map.ts', generated], ['../drizzle/0018_search_normalization.sql', statements.join('\n--> statement-breakpoint\n') + '\n']]) {
  const target = new URL(path, import.meta.url);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== content) throw new Error('Generated normalization differs: ' + path);
  } else writeFileSync(target, content);
}
console.log(`Unicode ${process.versions.unicode}: ${Object.keys(map).length} shared mappings.`);
