import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getBook } from '@/db/books';
import { getBookFile } from '@/db/book-files';
import { getBookRenderer } from '@/db/book-pages';
import { validImageId } from '@/db/images';
import { requestLanguage } from '@/lib/request-language';
import { contentMetadata, excerpt, safeJsonLd, siteOrigin } from '@/lib/content-metadata';
import { bookCovers, bookSalePath, purchaseOptions, saleCover } from '@/lib/book-sale';
import BookSale from '../../book-sale';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function read({ params, searchParams }: Props) {
  const { id } = await params;
  if (!validImageId(id)) notFound();
  const db = getPoemDb();
  const book = await getBook(db, id);
  if (!book) notFound();
  const language = await requestLanguage();
  const cover = saleCover(
    (await searchParams).coperta,
    bookCovers(book).map(item => item.cover),
  );
  let pages: number | null = null;
  try {
    const file = await getBookFile(db, book.file_id);
    if (file) pages = (await getBookRenderer().info(file)).pages;
  } catch {
    // The page count is a detail; the page works without it (e.g. no renderer).
  }
  return { book, language, cover, pages };
}

const coverImage = (book: Awaited<ReturnType<typeof read>>['book'], cover: 1 | 2 | null) => {
  const id = cover === 2 ? book.image_2_id : book.image_id || book.image_2_id;
  return id ? `/api/images/${id}?w=1280` : '/assets/poetio-balloons.png';
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { book, language, cover } = await read(props);
  const ro = language === 'ro';
  return contentMetadata({
    title: book.title,
    author: book.author,
    description: excerpt(
      book.description,
      ro ? `${book.title} — detalii și cumpărare pe Poetio.` : `${book.title} — details and purchase on Poetio.`,
    ),
    path: bookSalePath(book.id),
    image: coverImage(book, cover),
    language,
    type: 'book',
    published: book.created_at,
    updated: book.updated_at,
  });
}

export default async function BookSalePage(props: Props) {
  const { book, language, cover, pages } = await read(props);
  const options = purchaseOptions(book);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: book.title,
            ...(book.author ? { author: { '@type': 'Person', name: book.author } } : {}),
            ...(book.description ? { description: book.description } : {}),
            image: siteOrigin + coverImage(book, cover),
            ...(pages ? { numberOfPages: pages } : {}),
            url: siteOrigin + bookSalePath(book.id),
            ...(options.length
              ? { potentialAction: options.map(option => ({ '@type': 'BuyAction', target: option.url })) }
              : {}),
          }),
        }}
      />
      <BookSale book={book} initialLanguage={language} initialCover={cover} pages={pages} />
    </>
  );
}
