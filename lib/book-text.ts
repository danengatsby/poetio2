import { foldSearch } from './poem-search';

export const MAX_PAGE_TEXT = 64000;
export type BookPageText = {
  page: number;
  text: string;
  source: 'pdf' | 'ocr' | 'edited';
  language: 'ro' | 'en-US' | 'und';
  reviewed: boolean;
  revision: number;
};

export async function fetchBookText(fileId: string, page: number, signal: AbortSignal): Promise<BookPageText> {
  const response = await fetch(`/api/book-text/${fileId}/${page}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
  if (!response.ok) throw new Error('Text unavailable');
  return response.json();
}

export function textMatch(text: string, query: string) {
  return foldSearch(text.normalize('NFC')).indexOf(foldSearch(query.normalize('NFC')));
}

export type BookSearchResult = {
  status: 'preparing' | 'ready' | 'error';
  pages: number; scanned: number; unavailable: number;
  results: { page: number; excerpt: string }[];
  total: number; offset: number; hasMore: boolean;
};

export async function fetchBookSearch(fileId: string, query: string, offset: number, signal: AbortSignal, retry = false): Promise<BookSearchResult> {
  const params = new URLSearchParams({ q: query, offset: String(offset), ...(retry ? { retry: '1' } : {}) });
  const response = await fetch(`/api/book-text/${fileId}/search?${params}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
  if (!response.ok) throw new Error('Search unavailable');
  return response.json();
}
