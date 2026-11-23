import { rebuildPendingPoemSearch } from './poem-search-index';
import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import {
  POEM_PAGE_SIZE,
  POEM_EXCERPT_LENGTH,
  collectionQuery,
  poemExcerpt,
  withoutLeadingTitle,
  type CollectionParams,
  type PoemCard,
  type PoemCollection,
} from '../lib/poem-collection';
import { EXTRA_LANGUAGES, isExtraLanguage, type SiteLanguage } from '../lib/poem-types';
import { searchPredicate } from '../lib/poem-search';

/** SQL that is true when a version (translated, fr, de…) has both a title and a text. */
export const present = (prefix: string) =>
  `(length(trim(coalesce(${prefix}_title, ''))) > 0 AND length(trim(coalesce(${prefix}_content, ''), char(9)||char(10)||char(13)||' ')) > 0)`;
const translated = present('translated');

export async function listPoemCards(
  db: Database,
  params: CollectionParams = {},
  fallback: SiteLanguage = 'ro',
): Promise<PoemCollection> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { filters, page: requestedPage } = collectionQuery(params, fallback);
  if (filters.q || filters.theme) await rebuildPendingPoemSearch(db);
  const conditions: string[] = [],
    bindings: string[] = [];
  if (filters.q) {
    const search = searchPredicate(
      'poem_search',
      [
        'title',
        'content',
        'translated_title',
        'translated_content',
        ...EXTRA_LANGUAGES.flatMap(language => [`${language}_title`, `${language}_content`]),
      ],
      filters.q,
    );
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})`);
    bindings.push(...search.bindings);
  }
  if (filters.theme) {
    const search = searchPredicate(
      'poem_search',
      ['theme', 'translated_theme', ...EXTRA_LANGUAGES.map(language => `${language}_theme`)],
      filters.theme,
    );
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})`);
    bindings.push(...search.bindings);
  }
  // "With a translation" means a version in the reader's language: French on the French site, and so on.
  const extra = isExtraLanguage(filters.language) ? filters.language : null;
  const available = extra ? present(extra) : translated;
  if (filters.translation !== 'all') conditions.push(filters.translation === 'with' ? available : `NOT ${available}`);
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (await db
    .prepare(`SELECT COUNT(*) AS total FROM poems ${where}`)
    .bind(...bindings)
    .first<{ total: number }>())!.total;
  const pages = Math.max(1, Math.ceil(total / POEM_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  // Only the selected language and a bounded prefix leave SQLite. Full texts
  // stay in the individual poem route and in authenticated editorial queries.
  // The French and German sites show their own version when there is one, otherwise the original.
  const [prefix, use] = extra ? [extra, available] : ['translated', `(source_language <> ? AND ${translated})`];
  const display = (column: string) => `CASE WHEN ${use} THEN coalesce(${prefix}_${column}, '') ELSE ${column} END`;
  const placeholders = extra ? [] : Array(5).fill(filters.language);
  const rows = await db
    .prepare(
      `SELECT id, author, image_id, source_language,
    ${display('title')} AS title, ${display('theme')} AS theme,
    substr(trim(${display('content')}, char(9)||char(10)||char(13)||' '), 1, ${POEM_EXCERPT_LENGTH + 1}) AS excerpt,
    CASE WHEN ${use} THEN ${extra ? `'${extra}'` : '?'} ELSE source_language END AS language,
    ${available} AS has_translation,
    (SELECT COUNT(*) FROM poem_comments WHERE poem_id = poems.id AND status = 'approved') AS comment_count
    FROM poems ${where} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    )
    .bind(...placeholders, ...bindings, POEM_PAGE_SIZE, (page - 1) * POEM_PAGE_SIZE)
    .all<Omit<PoemCard, 'has_translation'> & { has_translation: number }>();
  return {
    poems: rows.results.map(row => ({
      ...row,
      excerpt: poemExcerpt(withoutLeadingTitle(row.excerpt, row.title)),
      has_translation: Boolean(row.has_translation),
    })),
    filters,
    total,
    page,
    pages,
  };
}
