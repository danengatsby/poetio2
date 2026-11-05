import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import type { BookWithCommentCount } from '@/lib/book-types';
import { listBooks } from '@/db/books';
import { isOwnerEmail } from '@/lib/access';
import { requestLanguage } from '@/lib/request-language';
import { getChatGPTUser } from '../chatgpt-auth';
import BooksView from './books-view';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const ro = await requestLanguage() === 'ro';
  return { title: ro ? 'Cărți — Poetio' : 'Books — Poetio', description: ro ? 'Colecția de cărți Poetio.' : 'The Poetio book collection.' };
}
export default async function BooksPage() {
  const language = await requestLanguage();
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let books: BookWithCommentCount[] = [];
  let failed = false;
  try { books = await listBooks(getPoemDb()); }
  catch (error) { console.error('Book collection unavailable', error); failed = true; }
  return <BooksView books={books} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
