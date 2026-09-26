import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getBook } from '@/db/books';
import { validImageId } from '@/db/images';
import { SITE_LANGUAGE_COOKIE, siteLanguage } from '@/lib/site-language';
import BooksView from '../books-view';
export const dynamic = 'force-dynamic';
export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validImageId(id)) notFound();
  const book = await getBook(getPoemDb(), id);
  if (!book) notFound();
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  return <BooksView book={book} initialLanguage={language} />;
}
