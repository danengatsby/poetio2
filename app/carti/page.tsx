import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { getShopSettings } from '@/db/shop';
import { publicShop } from '@/lib/shop';
import { saleVariants } from '@/lib/book-sale';
import { withoutPurchaseLinks } from '@/lib/book-types';
import { listBooks } from '@/db/books';
import { isOwnerEmail } from '@/lib/access';
import { pageMetadata } from '@/lib/content-metadata';
import { requestLanguage } from '@/lib/request-language';
import { getChatGPTUser } from '../chatgpt-auth';
import BooksView, { type LibraryBook } from './books-view';
import { pick } from '@/lib/site-language';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return pageMetadata({
    title: pick(
      language,
      'Cărți — Poetio',
      'Books — Poetio',
      'Livres — Poetio',
      'Bücher — Poetio',
      'Libros — Poetio',
      'Libri — Poetio',
    ),
    description: pick(
      language,
      'Colecția de cărți Poetio.',
      'The Poetio book collection.',
      'La collection de livres Poetio.',
      'Die Buchsammlung von Poetio.',
      'La colección de libros de Poetio.',
      'La collezione di libri di Poetio.',
    ),
    path: '/carti',
    language,
  });
}
export default async function BooksPage() {
  const language = await requestLanguage();
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let books: LibraryBook[] = [];
  let failed = false;
  try {
    const db = getPoemDb();
    const [items, settings] = await Promise.all([listBooks(db), getShopSettings(db)]);
    const shop = publicShop(settings);
    const sentences = new Intl.Segmenter(language, { granularity: 'sentence' });
    books = items.map(item => {
      const offer =
        shop.ready && !item.sold_out
          ? saleVariants(item).find(variant => variant.price.endsWith(' ' + shop.currency))
          : undefined;
      const description = sentences.segment(item.description.trim()).containing(0)?.segment.trim() ?? '';
      return { ...withoutPurchaseLinks(item), description, offer };
    });
  } catch (error) {
    console.error('Book collection unavailable', error);
    failed = true;
  }
  return <BooksView books={books} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
