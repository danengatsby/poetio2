import { bookPurchaseUrl, type Book } from './book-types';

export type CoverNumber = 1 | 2;
export type PurchaseOption = { cover: CoverNumber; url: string; host: string };

/** The book's valid purchase links, one per destination, with the store's host name. */
export function purchaseOptions(book: Pick<Book, 'purchase_url_1' | 'purchase_url_2'>): PurchaseOption[] {
  const options: PurchaseOption[] = [];
  for (const [cover, value] of [
    [1, book.purchase_url_1],
    [2, book.purchase_url_2],
  ] as const) {
    const url = bookPurchaseUrl(value);
    if (!url || options.some(option => option.url === url)) continue;
    options.push({ cover, url, host: new URL(url).hostname.replace(/^www\./, '') });
  }
  return options;
}

export function bookCovers(book: Pick<Book, 'image_id' | 'image_2_id'>) {
  return [
    { cover: 1 as CoverNumber, id: book.image_id },
    { cover: 2 as CoverNumber, id: book.image_2_id },
  ].filter((item): item is { cover: CoverNumber; id: string } => Boolean(item.id));
}

export function bookSalePath(id: string, cover?: CoverNumber) {
  return `/carti/${encodeURIComponent(id)}/cumpara${cover ? `?coperta=${cover}` : ''}`;
}

/** The cover named in ?coperta= when the book has it, otherwise the first one. */
export function saleCover(value: unknown, available: CoverNumber[]): CoverNumber | null {
  const asked = value === '1' ? 1 : value === '2' ? 2 : null;
  return asked && available.includes(asked) ? asked : (available[0] ?? null);
}
