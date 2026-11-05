import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import { POEM_PAGE_SIZE, POEM_EXCERPT_LENGTH, collectionQuery, poemExcerpt, type CollectionParams, type PoemCard, type PoemCollection } from '../lib/poem-collection';
import type { PoemLanguage } from '../lib/poem-types';
import { foldSearch as fold, sqlFoldSearch as sqlFold } from '../lib/poem-search';

const translated = `(length(trim(coalesce(translated_title, ''))) > 0 AND length(trim(coalesce(translated_content, ''), char(9)||char(10)||char(13)||' ')) > 0)`;

export async function listPoemCards(db: Database, params: CollectionParams = {}, fallback: PoemLanguage = 'ro'): Promise<PoemCollection> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { filters, page: requestedPage } = collectionQuery(params, fallback);
  const conditions: string[] = [], bindings: string[] = [];
  if (filters.q) {
    conditions.push('(' + ['title', 'content', 'translated_title', 'translated_content'].map(column => `instr(${sqlFold(column)}, ?) > 0`).join(' OR ') + ')');
    bindings.push(...Array(4).fill(fold(filters.q)));
  }
  if (filters.theme) {
    conditions.push(`(instr(${sqlFold('theme')}, ?) > 0 OR instr(${sqlFold('translated_theme')}, ?) > 0)`);
    bindings.push(fold(filters.theme), fold(filters.theme));
  }
  if (filters.translation !== 'all') conditions.push(filters.translation === 'with' ? translated : `NOT ${translated}`);
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (await db.prepare(`SELECT COUNT(*) AS total FROM poems ${where}`).bind(...bindings).first<{ total: number }>())!.total;
  const pages = Math.max(1, Math.ceil(total / POEM_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  // Only the selected language and a bounded prefix leave SQLite. Full texts
  // stay in the individual poem route and in authenticated editorial queries.
  const useTranslation = `(source_language <> ? AND ${translated})`;
  const display = (column: string) => `CASE WHEN ${useTranslation} THEN coalesce(translated_${column}, '') ELSE ${column} END`;
  const rows = await db.prepare(`SELECT id, author, image_id, source_language,
    ${display('title')} AS title, ${display('theme')} AS theme,
    substr(trim(${display('content')}, char(9)||char(10)||char(13)||' '), 1, ${POEM_EXCERPT_LENGTH + 1}) AS excerpt,
    CASE WHEN ${useTranslation} THEN ? ELSE source_language END AS language,
    ${translated} AS has_translation,
    (SELECT COUNT(*) FROM poem_comments WHERE poem_id = poems.id AND status = 'approved') AS comment_count
    FROM poems ${where} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`)
    .bind(...Array(5).fill(filters.language), ...bindings, POEM_PAGE_SIZE, (page - 1) * POEM_PAGE_SIZE)
    .all<Omit<PoemCard, 'has_translation'> & { has_translation: number }>();
  return { poems: rows.results.map(row => ({ ...row, excerpt: poemExcerpt(row.excerpt), has_translation: Boolean(row.has_translation) })), filters, total, page, pages };
}
