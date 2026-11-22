import { rebuildPendingPoemSearch } from './poem-search-index';
import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import {
  POEM_PAGE_SIZE,
  POEM_EXCERPT_LENGTH,
  collectionQuery,
  poemExcerpt,
  type CollectionParams,
  type PoemCard,
  type PoemCollection,
} from '../lib/poem-collection';
import type { SiteLanguage } from '../lib/poem-types';
import { searchPredicate } from '../lib/poem-search';

const present = (prefix: string) =>
  `(length(trim(coalesce(${prefix}_title, ''))) > 0 AND length(trim(coalesce(${prefix}_content, ''), char(9)||char(10)||char(13)||' ')) > 0)`;
const translated = present('translated');
const french = present('fr');

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
      ['title', 'content', 'translated_title', 'translated_content', 'fr_title', 'fr_content'],
      filters.q,
    );
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})`);
    bindings.push(...search.bindings);
  }
  if (filters.theme) {
    const search = searchPredicate('poem_search', ['theme', 'translated_theme', 'fr_theme'], filters.theme);
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})`);
    bindings.push(...search.bindings);
  }
  // "With a translation" means a version in the reader's language: French on the French site.
  const available = filters.language === 'fr' ? french : translated;
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
  // The French site shows the French version when there is one, otherwise the original.
  const [prefix, use] =
    filters.language === 'fr' ? ['fr', french] : ['translated', `(source_language <> ? AND ${translated})`];
  const display = (column: string) => `CASE WHEN ${use} THEN coalesce(${prefix}_${column}, '') ELSE ${column} END`;
  const placeholders = filters.language === 'fr' ? [] : Array(5).fill(filters.language);
  const rows = await db
    .prepare(
      `SELECT id, author, image_id, source_language,
    ${display('title')} AS title, ${display('theme')} AS theme,
    substr(trim(${display('content')}, char(9)||char(10)||char(13)||' '), 1, ${POEM_EXCERPT_LENGTH + 1}) AS excerpt,
    CASE WHEN ${use} THEN ${filters.language === 'fr' ? "'fr'" : '?'} ELSE source_language END AS language,
    ${available} AS has_translation,
    (SELECT COUNT(*) FROM poem_comments WHERE poem_id = poems.id AND status = 'approved') AS comment_count
    FROM poems ${where} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    )
    .bind(...placeholders, ...bindings, POEM_PAGE_SIZE, (page - 1) * POEM_PAGE_SIZE)
    .all<Omit<PoemCard, 'has_translation'> & { has_translation: number }>();
  return {
    poems: rows.results.map(row => ({
      ...row,
      excerpt: poemExcerpt(row.excerpt),
      has_translation: Boolean(row.has_translation),
    })),
    filters,
    total,
    page,
    pages,
  };
}
