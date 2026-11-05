import { foldSearch } from './search-normalization';
export { foldSearch, sqlFoldSearch } from './search-normalization';

// One trigram selects a superset of literal matches. A long positional FTS
// phrase can be extremely expensive for repetitive text. instr checks the full
// value and preserves punctuation, spacing and substring semantics.
export function searchPredicate(table: 'poem_search' | 'book_search_pages', columns: string[], value: string) {
  const text = foldSearch(value);
  const exact = '(' + columns.map(column => `instr(${column}, ?) > 0`).join(' OR ') + ')';
  if (Array.from(text).length < 3 || text.includes('\0')) return { sql: exact, bindings: columns.map(() => text) };
  const characters = Array.from(text);
  const candidates = Array.from({ length: characters.length - 2 }, (_, index) => characters.slice(index, index + 3).join(''));
  // Prefer a diverse trigram; repeated trigrams add no candidate information.
  const trigram = candidates.reduce((best, next) => new Set(next).size > new Set(best).size ? next : best);
  const index = table === 'poem_search' ? 'poem_search_fts' : 'book_search_fts';
  return {
    sql: `rowid IN (SELECT rowid FROM ${index} WHERE ${index} MATCH ?) AND ${exact}`,
    bindings: [`{${columns.join(' ')}} : "${trigram.replaceAll('"', '""')}"`, ...columns.map(() => text)],
  };
}
