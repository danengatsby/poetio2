import { foldSearch } from '../lib/search-normalization';
import type { PoemInput } from '../lib/poem-types';
import type { Database, Statement } from './poems';

/** The columns of poem_search, as of the latest migration. */
export const POEM_SEARCH_COLUMNS = [
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
  'de_title',
  'de_theme',
  'de_content',
] as const;
type SearchColumn = (typeof POEM_SEARCH_COLUMNS)[number];
const setOf = (columns: readonly SearchColumn[]) => columns.map(column => column + '=?').join(', ');
const removePending = 'DELETE FROM poem_search_pending WHERE poem_id=?';

// SQLite's changes() in this transaction refers to the preceding top-level
// statement, excluding triggers. A failed revision check cannot update the index.
export async function writeIndexedPoem(db: Database, statement: Statement, id: string, poem: PoemInput) {
  const values = POEM_SEARCH_COLUMNS.map(column => poem[column] ?? '');
  const batch = [statement];
  if (values.some(value => value !== value.normalize('NFC'))) {
    batch.push(
      db
        .prepare(`UPDATE poem_search SET ${setOf(POEM_SEARCH_COLUMNS)} WHERE poem_id=? AND changes()=1`)
        .bind(...values.map(foldSearch), id),
    );
  }
  batch.push(db.prepare(removePending + ' AND changes()=1').bind(id));
  const [result] = (await db.batch(batch)) as { meta: { changes: number } }[];
  return result;
}

// Migrations and direct SQL imports enqueue originals. A token belongs to
// one particular write, including imports that preserve the editorial revision.
// A migration's data step passes the columns that existed at that migration.
export async function rebuildPendingPoemSearch(
  db: Database,
  rebuildAll = false,
  columns: readonly SearchColumn[] = POEM_SEARCH_COLUMNS,
) {
  const assignments = setOf(columns);
  const select = `SELECT pending.poem_id, pending.token, ${columns.map(column => 'poems.' + column).join(', ')}
    FROM poem_search_pending AS pending JOIN poems ON poems.id=pending.poem_id LIMIT 12`;
  for (;;) {
    const { results } = await db.prepare(select).all<PoemInput & { poem_id: string; token: string }>();
    if (!results.length) return;
    const statements: Statement[] = [];
    for (const row of results) {
      const values = columns.map(column => row[column] ?? '');
      // The existing SQL triggers already indexed NFC originals at write time.
      if (rebuildAll || values.some(value => value !== value.normalize('NFC'))) {
        statements.push(
          db
            .prepare(
              `UPDATE poem_search SET ${assignments} WHERE poem_id=?
          AND EXISTS (SELECT 1 FROM poem_search_pending WHERE poem_id=? AND token=?)`,
            )
            .bind(...values.map(foldSearch), row.poem_id, row.poem_id, row.token),
        );
      }
      statements.push(db.prepare(removePending + ' AND token=?').bind(row.poem_id, row.token));
    }
    await db.batch(statements);
  }
}
