import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { withoutPurchaseLinks, type BookWithCommentCount } from '@/lib/book-types';
import { listBooks } from '@/db/books';
import { isOwnerEmail } from '@/lib/access';
import { pageMetadata } from '@/lib/content-metadata';
import { requestLanguage } from '@/lib/request-language';
import { getChatGPTUser } from '../chatgpt-auth';
import BooksView from './books-view';
import { pick } from '@/lib/site-language';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return pageMetadata({
    title: pick(language, 'Cărți — Poetio', 'Books — Poetio', 'Livres — Poetio', 'Bücher — Poetio', 'Libros — Poetio'),
    description: pick(
      language,
      'Colecția de cărți Poetio.',
      'The Poetio book collection.',
      'La collection de livres Poetio.',
      'Die Buchsammlung von Poetio.',
      'La colección de libros de Poetio.',
    ),
    path: '/carti',
    language,
  });
}
export default async function BooksPage() {
  const language = await requestLanguage();
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let books: BookWithCommentCount[] = [];
  let failed = false;
  try {
    books = (await listBooks(getPoemDb())).map(withoutPurchaseLinks);
  } catch (error) {
    console.error('Book collection unavailable', error);
    failed = true;
  }
  return <BooksView books={books} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
