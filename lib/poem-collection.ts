import type { PoemLanguage } from './poem-types';
import { siteLanguage } from './site-language';

export const POEM_PAGE_SIZE = 12;
export const POEM_EXCERPT_LENGTH = 240;
export type CollectionParams = Record<string, string | string[] | undefined>;
export type CollectionFilters = { q: string; theme: string; translation: 'all' | 'with' | 'without'; language: PoemLanguage };
export type PoemCard = {
  id: string; title: string; author: string; theme: string; excerpt: string;
  image_id: string | null; language: PoemLanguage; source_language: PoemLanguage;
  has_translation: boolean; comment_count: number;
};
export type PoemCollection = { poems: PoemCard[]; filters: CollectionFilters; total: number; page: number; pages: number };

export function collectionQuery(params: CollectionParams, fallback: PoemLanguage = 'ro') {
  const value = (key: string) => { const item = params[key]; return Array.isArray(item) ? item[0] ?? '' : item ?? ''; };
  const language = value('lang');
  const translation = value('translation');
  const filters: CollectionFilters = {
    q: Array.from(value('q').trim()).slice(0, 120).join(''),
    theme: Array.from(value('theme').trim()).slice(0, 80).join(''),
    translation: translation === 'with' || translation === 'without' ? translation : 'all',
    language: siteLanguage(language, fallback),
  };
  return { filters, page: /^[1-9]\d{0,6}$/.test(value('page')) ? Number(value('page')) : 1 };
}

export function collectionHref(filters: CollectionFilters, page = 1) {
  const query = new URLSearchParams({ lang: filters.language });
  if (filters.q) query.set('q', filters.q);
  if (filters.theme) query.set('theme', filters.theme);
  if (filters.translation !== 'all') query.set('translation', filters.translation);
  if (page > 1) query.set('page', String(page));
  return '/?' + query.toString() + '#collection';
}

export function collectionReturnHref(value: string | undefined, language: PoemLanguage) {
  const fallback = collectionHref({ q: '', theme: '', translation: 'all', language });
  if (!value || value.length > 2048) return fallback;
  try {
    const url = new URL(value, 'https://collection.invalid');
    if (!value.startsWith('/') || url.origin !== 'https://collection.invalid' || url.pathname !== '/') return fallback;
    const query = collectionQuery(Object.fromEntries(url.searchParams), language);
    return collectionHref(query.filters, query.page);
  } catch { return fallback; }
}

export function poemExcerpt(prefix: string) {
  const text = prefix.trim();
  const lines = text.split('\n').filter(line => line.trim()).slice(0, 2).join('\n');
  const chars = Array.from(lines);
  return lines.length < text.length || chars.length > POEM_EXCERPT_LENGTH
    ? chars.slice(0, POEM_EXCERPT_LENGTH - 1).join('') + '…' : lines;
}
