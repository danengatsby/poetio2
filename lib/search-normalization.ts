import { searchFoldMap } from './search-fold-map';

// The versioned map is shared with SQLite. Per-character Unicode lowercase
// preserves accents outside Romanian; Romanian accents keep the existing fold.
export const foldSearch = (text: string) => text.replace(/[^\x00-\x7f]/gu, letter => searchFoldMap[letter] ?? letter).replace(/[A-Z]/g, letter => String.fromCharCode(letter.charCodeAt(0) + 32));

// Only mappings present in this value are applied. ASCII values bypass the
// mapping table entirely; work happens at writes, not at every search.
export function sqlFoldSearch(column: string) {
  const value = `coalesce(${column}, '')`;
  return `(CASE WHEN length(CAST(${value} AS BLOB)) = length(${value}) THEN lower(${value}) ELSE (
    WITH RECURSIVE changes AS MATERIALIZED (
      SELECT letter, replacement, row_number() OVER (ORDER BY letter) AS n
      FROM search_fold_characters WHERE instr(${value}, letter) > 0
    ), folded(n, value) AS (
      SELECT 0, lower(${value})
      UNION ALL SELECT folded.n + 1, replace(folded.value, changes.letter, changes.replacement)
      FROM folded JOIN changes ON changes.n = folded.n + 1
    ) SELECT value FROM folded ORDER BY n DESC LIMIT 1
  ) END)`;
}
