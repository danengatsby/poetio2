/* eslint-disable @next/next/no-img-element -- Uploaded derivatives and local previews use the same image display. */
import { bookPurchaseUrl, type Book } from '@/lib/book-types';
import { bookSalePath, purchaseOptions, type CoverNumber } from '@/lib/book-sale';
import { withSiteLanguage } from '@/lib/site-language';
import type { PoemLanguage } from '@/lib/poem-types';
import { responsiveImage } from '@/lib/responsive-images';

export type CoverBook = Pick<
  Book,
  'id' | 'title' | 'author' | 'image_id' | 'image_2_id' | 'purchase_url_1' | 'purchase_url_2'
>;
export default function BookCovers({
  book,
  language,
  previewSources = [],
  compact = false,
  saleLinks = true,
}: {
  book: CoverBook;
  language: PoemLanguage;
  previewSources?: (string | undefined)[];
  compact?: boolean;
  /** With a purchase link, covers open the book's sale page (not in the editor's preview). */
  saleLinks?: boolean;
}) {
  const ro = language === 'ro';
  const sale = saleLinks && Boolean(book.id) && purchaseOptions(book).length > 0;
  const covers = [
    { number: 1, id: book.image_id, url: book.purchase_url_1, src: previewSources[0] },
    { number: 2, id: book.image_2_id, url: book.purchase_url_2, src: previewSources[1] },
  ].filter(cover => cover.id || cover.src);
  if (!covers.length)
    return (
      <div className="book-covers" data-count="1">
        <span className="book-cover book-cover-placeholder">
          <span>Poetio✳</span>
          <span>{book.title}</span>
          <small>{book.author}</small>
        </span>
      </div>
    );
  return (
    <div
      className={`book-covers${compact ? ' book-covers-compact' : ''}`}
      data-count={covers.length}
      role="group"
      aria-label={ro ? 'Coperți și achiziție' : 'Covers and purchase'}
    >
      {covers.map(cover => {
        const url = bookPurchaseUrl(cover.url),
          label = `${ro ? 'Coperta' : 'Cover'} ${cover.number}`;
        const content = (
          <>
            <img
              className="book-cover"
              {...(cover.src ? { src: cover.src } : responsiveImage(`/api/images/${cover.id}`))}
              sizes={compact ? '(max-width:760px) 42vw, 180px' : '(max-width:760px) 44vw, 220px'}
              width={300}
              height={400}
              alt={`${label}: ${book.title}`}
              loading="lazy"
              decoding="async"
            />
            <span className="book-cover-caption">
              <span>{label}</span>
              {sale ? (
                <span className="book-cover-buy">{ro ? 'Cumpără' : 'Buy'}</span>
              ) : (
                url && (
                  <span className="book-cover-buy">
                    {ro ? 'Cumpără' : 'Buy'} <span aria-hidden="true">↗</span>
                  </span>
                )
              )}
            </span>
          </>
        );
        if (sale)
          return (
            <a
              key={cover.number}
              className="book-cover-option book-cover-link"
              data-cover={cover.number}
              href={withSiteLanguage(bookSalePath(book.id, cover.number as CoverNumber), language)}
              aria-label={
                ro
                  ? `Detalii și cumpărare: ${book.title} — ${label.toLowerCase()}`
                  : `Details and purchase: ${book.title} — ${label.toLowerCase()}`
              }
            >
              {content}
            </a>
          );
        return url ? (
          <a
            key={cover.number}
            className="book-cover-option book-cover-link"
            data-cover={cover.number}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              ro
                ? `Cumpără ${book.title} — ${label.toLowerCase()} (se deschide într-o filă nouă)`
                : `Buy ${book.title} — ${label.toLowerCase()} (opens in a new tab)`
            }
          >
            {content}
          </a>
        ) : (
          <div key={cover.number} className="book-cover-option" data-cover={cover.number}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
