import type { Book } from './book-types';
import { normalizeBookPrice } from './book-price';

export type CoverNumber = 1 | 2;
/** The covers sold on Poetio: those with a price. */
export type SaleVariant = { cover: CoverNumber; price: string };
export function saleVariants(book: Partial<Pick<Book, 'price_1' | 'price_2'>>): SaleVariant[] {
  return (
    [
      [1, book.price_1],
      [2, book.price_2],
    ] as const
  ).flatMap(([cover, value]) => {
    const price = normalizeBookPrice(value);
    return price ? [{ cover, price }] : [];
  });
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
