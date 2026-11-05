// SQLite lower() handles ASCII. Fold Romanian letters identically on D1 and VPS.
const letters: Record<string, string> = { Ă: 'a', ă: 'a', Â: 'a', â: 'a', Î: 'i', î: 'i', Ș: 's', ș: 's', Ş: 's', ş: 's', Ț: 't', ț: 't', Ţ: 't', ţ: 't' };
export const foldSearch = (text: string) => text.replace(/[ĂăÂâÎîȘșŞşȚțŢţ]/g, letter => letters[letter]).toLowerCase();
// Column names come only from static server-side lists, never from request input.
export const sqlFoldSearch = (column: string) => Object.entries(letters).reduce((sql, [letter, replacement]) => `replace(${sql}, '${letter}', '${replacement}')`, `lower(coalesce(${column}, ''))`);

// Phrase quoting keeps operator words and punctuation literal. Short strings
// search the normalized projection because trigram indexes require 3 letters.
export function searchPredicate(table: 'poem_search' | 'book_search_pages', columns: string[], value: string) {
  const text = foldSearch(value);
  const exact = '(' + columns.map(column => `instr(${column}, ?) > 0`).join(' OR ') + ')';
  if (Array.from(text).length < 3 || text.includes('\0')) return { sql: exact, bindings: columns.map(() => text) };
  const index = table === 'poem_search' ? 'poem_search_fts' : 'book_search_fts';
  return {
    sql: `rowid IN (SELECT rowid FROM ${index} WHERE ${index} MATCH ?) AND ${exact}`,
    bindings: [`{${columns.join(' ')}} : "${text.replaceAll('"', '""')}"`, ...columns.map(() => text)],
  };
}
