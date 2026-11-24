import { rebuildPendingPoemSearch } from './poem-search-index';
import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import {
  POEM_PAGE_SIZE,
  collectionQuery,
  type CollectionParams,
  type PoemCard,
  type PoemCollection,
} from '../lib/poem-collection';
import { EXTRA_LANGUAGES, isExtraLanguage, type SiteLanguage } from '../lib/poem-types';
import { searchPredicate } from '../lib/poem-search';

/** SQL that is true when a version (translated, fr, de…) has both a title and a text. */
export const present = (prefix: string) =>
  `(length(trim(coalesce(${prefix}_title, ''))) > 0 AND length(trim(coalesce(${prefix}_content, ''), char(9)||char(10)||char(13)||' ')) > 0)`;

// Choose the same version for card labels, theme counts and reading suggestions.
function poemColumns(language: SiteLanguage) {
  const extra = isExtraLanguage(language) ? language : null;
  const prefix = extra ?? 'translated';
  const available = present('poems.' + prefix);
  const use = extra ? available : `(source_language <> '${language === 'ro' ? 'ro' : 'en-US'}' AND ${available})`;
  const display = (column: string, table = 'poems') =>
    `CASE WHEN ${use} THEN coalesce(${table}.${prefix}_${column}, '') ELSE ${table}.${column} END`;
  return { available, display, locale: `CASE WHEN ${use} THEN '${language}' ELSE source_language END` };
}

export async function nextPoem(db: Database, current: { id: string; created_at: number }, language: SiteLanguage) {
  const { display, locale } = poemColumns(language);
  // Cycle forward in collection order, giving poems on the same original theme priority.
  await rebuildPendingPoemSearch(db);
  return db
    .prepare(
      `SELECT poems.id, ${display('title')} AS title, ${locale} AS language,
      CASE WHEN current.theme <> '' AND candidate.theme = current.theme THEN ${display('theme')} ELSE '' END AS theme
    FROM poems JOIN poem_search AS candidate ON candidate.poem_id = poems.id
    JOIN poem_search AS current ON current.poem_id = ?
    WHERE poems.id <> ?
    ORDER BY (current.theme <> '' AND candidate.theme = current.theme) DESC,
      (poems.created_at, poems.id) > (?, ?) DESC, poems.created_at, poems.id LIMIT 1`,
    )
    .bind(current.id, current.id, current.created_at, current.id)
    .first<Pick<PoemCard, 'id' | 'title' | 'language' | 'theme'>>();
}

export async function listPoemCards(
  db: Database,
  params: CollectionParams = {},
  fallback: SiteLanguage = 'ro',
): Promise<PoemCollection> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { filters, page: requestedPage } = collectionQuery(params, fallback);
  await rebuildPendingPoemSearch(db);
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
  const { available, display, locale } = poemColumns(filters.language);
  if (filters.translation !== 'all') conditions.push(filters.translation === 'with' ? available : `NOT ${available}`);
  const scope = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const key = display('theme', 'poem_search');
  const themes = await db
    .prepare(
      `SELECT ${key} AS key, MIN(${display('theme')}) AS label, COUNT(*) AS count
    FROM poems JOIN poem_search ON poem_search.poem_id = poems.id ${scope}
    GROUP BY ${key} HAVING ${key} <> '' ORDER BY count DESC, label COLLATE NOCASE`,
    )
    .bind(...bindings)
    .all<PoemCollection['themes'][number]>();
  if (filters.topic) {
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE poem_id = poems.id AND ${key} = ?)`);
    bindings.push(filters.topic);
  } else if (filters.theme) {
    const search = searchPredicate(
      'poem_search',
      ['theme', 'translated_theme', ...EXTRA_LANGUAGES.map(language => `${language}_theme`)],
      filters.theme,
    );
    conditions.push(`id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})`);
    bindings.push(...search.bindings);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (await db
    .prepare(`SELECT COUNT(*) AS total FROM poems ${where}`)
    .bind(...bindings)
    .first<{ total: number }>())!.total;
  const pages = Math.max(1, Math.ceil(total / POEM_PAGE_SIZE));
  let page = Math.min(requestedPage, pages);
  // A saved selection may have moved to another page since the link was created.
  if (pages > 1 && typeof params.poem === 'string' && params.poem) {
    const selected = await db
      .prepare(
        `SELECT position FROM (
      SELECT id, row_number() OVER (ORDER BY created_at, id) AS position FROM poems ${where}
    ) WHERE id = ?`,
      )
      .bind(...bindings, params.poem)
      .first<{ position: number }>();
    if (selected) page = Math.ceil(selected.position / POEM_PAGE_SIZE);
  }
  // Return the complete reading text only for the selected language and page.
  const rows = await db
    .prepare(
      `SELECT id, author, source_language, audio_ro_id, audio_en_id,
    ${display('title')} AS title, ${display('theme')} AS theme,
    ${display('content')} AS content,
    ${locale} AS language,
    ${available} AS has_translation,
    (SELECT COUNT(*) FROM poem_comments WHERE poem_id = poems.id AND status = 'approved') AS comment_count
    FROM poems ${where} ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, POEM_PAGE_SIZE, (page - 1) * POEM_PAGE_SIZE)
    .all<Omit<PoemCard, 'has_translation'> & { has_translation: number }>();
  return {
    poems: rows.results.map(row => ({
      ...row,
      has_translation: Boolean(row.has_translation),
    })),
    filters,
    themes: themes.results,
    total,
    page,
    pages,
  };
}
