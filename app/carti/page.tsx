import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getPoemDb } from '@/db/binding';
import type { BookWithCommentCount } from '@/lib/book-types';
import { listBooks } from '@/db/books';
import { isOwnerEmail } from '@/lib/access';
import { SITE_LANGUAGE_COOKIE, siteLanguage } from '@/lib/site-language';
import { getChatGPTUser } from '../chatgpt-auth';
import BooksView from './books-view';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cărți — Poetio', description: 'Colecția de cărți Poetio.' };
export default async function BooksPage() {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let books: BookWithCommentCount[] = [];
  let failed = false;
  try { books = await listBooks(getPoemDb()); }
  catch (error) { console.error('Book collection unavailable', error); failed = true; }
  return <BooksView books={books} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
