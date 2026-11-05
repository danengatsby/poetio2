import type { Poem } from './poem-types';
import { collectionQuery, type CollectionParams } from './poem-collection';

export const ADMIN_POEM_PAGE_SIZE = 20;
export type AdminPoemSummary = Pick<Poem, 'id' | 'title' | 'author' | 'image_id'>;
export type AdminPoemCollection = { poems: AdminPoemSummary[]; q: string; total: number; page: number; pages: number };
export const emptyAdminPoems: AdminPoemCollection = { poems: [], q: '', total: 0, page: 1, pages: 1 };

export function adminPoemQuery(params: CollectionParams) {
  const { filters, page } = collectionQuery(params);
  return { q: filters.q, page };
}

export function adminPoemListUrl(page: number, q: string) {
  return '/api/admin/poems?' + new URLSearchParams({ page: String(page), q });
}
