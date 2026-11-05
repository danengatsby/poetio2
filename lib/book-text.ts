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
  return text.normalize('NFC').toLocaleLowerCase('ro').indexOf(query.normalize('NFC').toLocaleLowerCase('ro'));
}
