import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getBook } from '@/db/books';
import { getBookFile } from '@/db/book-files';
import { getBookRenderer } from '@/db/book-pages';
import { validImageId } from '@/db/images';
import { getBookShop, getShopSettings } from '@/db/shop';
import { requestLanguage } from '@/lib/request-language';
import { contentMetadata, excerpt, safeJsonLd, siteOrigin } from '@/lib/content-metadata';
import { bookCovers, bookSalePath, saleCover, saleVariants } from '@/lib/book-sale';
import { withoutPurchaseLinks } from '@/lib/book-types';
import { deliveryWindow, publicShop } from '@/lib/shop';
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
  const found = await getBook(db, id);
  if (!found) notFound();
  const book = withoutPurchaseLinks(found);
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
  return { db, book, language, cover, pages };
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
      ro ? `${book.title} — comandă cartea pe Poetio.` : `${book.title} — order the book on Poetio.`,
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
  const { db, book, language, cover, pages } = await read(props);
  const [settings, stock] = await Promise.all([getShopSettings(db), getBookShop(db, book.id)]);
  const shop = publicShop(settings);
  const now = new Date();
  const delivery = { ro: deliveryWindow(now, settings, 'ro'), 'en-US': deliveryWindow(now, settings, 'en-US') };
  const offers = shop.ready
    ? saleVariants(book).filter(variant => variant.price.endsWith(` ${settings.currency}`))
    : [];
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
            ...(stock.language ? { inLanguage: stock.language } : {}),
            image: siteOrigin + coverImage(book, cover),
            ...(pages ? { numberOfPages: pages } : {}),
            url: siteOrigin + bookSalePath(book.id),
            ...(offers.length
              ? {
                  offers: offers.map(offer => {
                    const [price, priceCurrency] = offer.price.split(' ');
                    return {
                      '@type': 'Offer',
                      price,
                      priceCurrency,
                      url: siteOrigin + bookSalePath(book.id, offer.cover),
                      availability: `https://schema.org/${stock.stock === 0 ? 'OutOfStock' : 'InStock'}`,
                      seller: { '@type': 'Organization', name: settings.seller_name },
                    };
                  }),
                }
              : {}),
          }),
        }}
      />
      <BookSale
        book={book}
        initialLanguage={language}
        initialCover={cover}
        pages={pages}
        shop={shop}
        stock={stock.stock}
        bookLanguage={stock.language}
        delivery={delivery}
      />
    </>
  );
}
