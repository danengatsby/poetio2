import { translationStatus } from '../lib/translation-provenance';
import { isExtraLanguage, EXTRA_LANGUAGES } from '../lib/poem-types';
import { SITE_LANGUAGES } from '../lib/site-language';
import { rebuildPendingPoemSearch } from './poem-search-index';
import { ensureInitialPoems, ensureLanguageVariants, readPoem, type StoredPoem, type Database } from './poems';
import {
  ADMIN_POEM_PAGE_SIZE,
  adminPoemQuery,
  type AdminPoemCollection,
  type AdminPoemSummary,
} from '../lib/poem-admin-list';
import type { CollectionParams } from '../lib/poem-collection';
import { searchPredicate } from '../lib/poem-search';

export async function listAdminPoems(db: Database, params: CollectionParams = {}): Promise<AdminPoemCollection> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { q, page: requestedPage } = adminPoemQuery(params);
  if (q) await rebuildPendingPoemSearch(db);
  const columns = [
    'title',
    'author',
    'theme',
    'content',
    'translated_title',
    'translated_theme',
    'translated_content',
    ...EXTRA_LANGUAGES.flatMap(lang => [`${lang}_title`, `${lang}_theme`, `${lang}_content`]),
  ];
  const search = q ? searchPredicate('poem_search', columns, q) : null;
  const where = search ? `WHERE id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})` : '';
  const bindings = search?.bindings ?? [];
  const total = (await db
    .prepare(`SELECT COUNT(*) AS total FROM poems ${where}`)
    .bind(...bindings)
    .first<{ total: number }>())!.total;
  const pages = Math.max(1, Math.ceil(total / ADMIN_POEM_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  // Never select poem bodies, translations, provenance or comment counts for the list.
  const { results: poems } = await db
    .prepare(
      `SELECT id, title, author, image_id FROM poems ${where}
    ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, ADMIN_POEM_PAGE_SIZE, (page - 1) * ADMIN_POEM_PAGE_SIZE)
    .all<AdminPoemSummary>();
  return { poems, q, total, page, pages };
}

/** Only the requested page is inspected; the client receives status labels, not the poems. */
export async function translationInventory(db: Database, ids: string[]) {
  if (!ids.length) return [];
  const { results } = await db
    .prepare(`SELECT * FROM poems WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at,id`)
    .bind(...ids)
    .all<StoredPoem>();
  return Promise.all(
    results.map(async row => {
      const poem = readPoem(row);
      const states = await Promise.all(
        SITE_LANGUAGES.map(async lang => [
          lang,
          lang === poem.source_language
            ? 'original'
            : await translationStatus(poem, isExtraLanguage(lang) ? lang : 'translated'),
        ]),
      );
      return { id: poem.id, title: poem.title, states: Object.fromEntries(states) };
    }),
  );
}
