import { ensureInitialPoems, ensureLanguageVariants, type Database } from './poems';
import { ADMIN_POEM_PAGE_SIZE, adminPoemQuery, type AdminPoemCollection, type AdminPoemSummary } from '../lib/poem-admin-list';
import type { CollectionParams } from '../lib/poem-collection';
import { searchPredicate } from '../lib/poem-search';

export async function listAdminPoems(db: Database, params: CollectionParams = {}): Promise<AdminPoemCollection> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  const { q, page: requestedPage } = adminPoemQuery(params);
  const columns = ['title', 'author', 'theme', 'content', 'translated_title', 'translated_theme', 'translated_content'];
  const search = q ? searchPredicate('poem_search', columns, q) : null;
  const where = search ? `WHERE id IN (SELECT poem_id FROM poem_search WHERE ${search.sql})` : '';
  const bindings = search?.bindings ?? [];
  const total = (await db.prepare(`SELECT COUNT(*) AS total FROM poems ${where}`).bind(...bindings).first<{ total: number }>())!.total;
  const pages = Math.max(1, Math.ceil(total / ADMIN_POEM_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  // Never select poem bodies, translations, provenance or comment counts for the list.
  const { results: poems } = await db.prepare(`SELECT id, title, author, image_id FROM poems ${where}
    ORDER BY created_at ASC, id ASC LIMIT ? OFFSET ?`)
    .bind(...bindings, ADMIN_POEM_PAGE_SIZE, (page - 1) * ADMIN_POEM_PAGE_SIZE).all<AdminPoemSummary>();
  return { poems, q, total, page, pages };
}
