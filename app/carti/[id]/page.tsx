import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getBook } from '@/db/books';
import { validImageId } from '@/db/images';
import { requestLanguage } from '@/lib/request-language';
import { contentMetadata, contentPath, excerpt } from '@/lib/content-metadata';
import BooksView from '../books-view';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

async function read({ params }: Props) {
  const { id } = await params;
  if (!validImageId(id)) notFound();
  const book = await getBook(getPoemDb(), id);
  if (!book) notFound();
  const language = await requestLanguage();
  return { book, language };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { book, language } = await read(props);
  // Books have one editorial version. Locale follows the interface preference;
  // the saved title/description and canonical URL do not imply a translation.
  return contentMetadata({
    title: book.title,
    author: book.author,
    description: excerpt(book.description, language === 'en-US'
      ? `${book.title} — Read on Poetio.`
      : `${book.title} — Citește pe Poetio.`),
    path: contentPath('book', book.id),
    image: book.image_id ? `/api/images/${book.image_id}?w=1280` : '/assets/poetio-balloons.png',
    language,
    type: 'book',
    published: book.created_at,
    updated: book.updated_at,
  });
}

export default async function BookPage(props: Props) {
  const { book, language } = await read(props);
  return <BooksView book={book} initialLanguage={language} />;
}
