import type { PoemLanguage, SiteLanguage } from './poem-types';
import { siteLanguage } from './site-language';

export const POEM_PAGE_SIZE = 12;
export type CollectionParams = Record<string, string | string[] | undefined>;
export type CollectionFilters = {
  q: string;
  theme: string;
  topic?: string;
  translation: 'all' | 'with' | 'without';
  language: SiteLanguage;
};
export type PoemCard = {
  id: string;
  title: string;
  author: string;
  theme: string;
  content: string;
  language: SiteLanguage;
  source_language: PoemLanguage;
  has_translation: boolean;
  comment_count: number;
};
export type PoemCollection = {
  poems: PoemCard[];
  themes: { label: string; key: string; count: number }[];
  filters: CollectionFilters;
  total: number;
  page: number;
  pages: number;
};

export function collectionQuery(params: CollectionParams, fallback: SiteLanguage = 'ro') {
  const value = (key: string) => {
    const item = params[key];
    return Array.isArray(item) ? (item[0] ?? '') : (item ?? '');
  };
  const language = value('lang');
  const translation = value('translation');
  const filters: CollectionFilters = {
    q: Array.from(value('q').trim().normalize('NFC')).slice(0, 120).join(''),
    theme: params.topic === undefined ? Array.from(value('theme').trim().normalize('NFC')).slice(0, 80).join('') : '',
    topic: Array.from(value('topic').trim().normalize('NFC')).slice(0, 80).join(''),
    translation: translation === 'with' || translation === 'without' ? translation : 'all',
    language: siteLanguage(language, fallback),
  };
  return { filters, page: /^[1-9]\d{0,6}$/.test(value('page')) ? Number(value('page')) : 1 };
}

export function collectionHref(filters: CollectionFilters, page = 1, selectedId?: string) {
  const query = new URLSearchParams({ lang: filters.language });
  if (filters.q) query.set('q', filters.q);
  if (filters.topic) query.set('topic', filters.topic);
  else if (filters.theme) query.set('theme', filters.theme);
  if (filters.translation !== 'all') query.set('translation', filters.translation);
  if (page > 1) query.set('page', String(page));
  if (selectedId) query.set('poem', selectedId);
  return '/?' + query.toString() + (selectedId ? '#collection-reader' : '#collection');
}

export function collectionReturnHref(value: string | undefined, language: SiteLanguage) {
  const fallback = collectionHref({ q: '', theme: '', translation: 'all', language });
  if (!value || value.length > 2048) return fallback;
  try {
    const url = new URL(value, 'https://collection.invalid');
    if (!value.startsWith('/') || url.origin !== 'https://collection.invalid' || url.pathname !== '/') return fallback;
    const query = collectionQuery(Object.fromEntries(url.searchParams), language);
    const filters = query.filters;
    if (filters.language !== language && filters.topic) {
      filters.theme = filters.topic;
      filters.topic = '';
    }
    return collectionHref({ ...filters, language }, query.page, url.searchParams.get('poem') || undefined);
  } catch {
    return fallback;
  }
}

/** A poem whose first line repeats its title (common in the originals) starts after that line in summaries. */
export function withoutLeadingTitle(text: string, title: string) {
  const lines = text.split('\n');
  const first = lines.findIndex(line => line.trim());
  const plain = (value: string) =>
    value
      .normalize('NFC')
      .trim()
      .replace(/[\s.,;:!?…—–-]+$/u, '')
      .toLocaleLowerCase();
  return first >= 0 && plain(title) && plain(lines[first]) === plain(title) ? lines.slice(first + 1).join('\n') : text;
}
