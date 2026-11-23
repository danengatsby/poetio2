/* eslint-disable @next/next/no-img-element -- Uploaded derivatives and local previews use the same image display. */
import type { Book } from '@/lib/book-types';
import { bookSalePath, saleVariants, type CoverNumber } from '@/lib/book-sale';
import { pick, withSiteLanguage } from '@/lib/site-language';
import type { SiteLanguage } from '@/lib/poem-types';
import { responsiveImage } from '@/lib/responsive-images';

export type CoverBook = Pick<Book, 'id' | 'title' | 'author' | 'image_id' | 'image_2_id' | 'price_1' | 'price_2'>;
export default function BookCovers({
  book,
  language,
  previewSources = [],
  compact = false,
  saleLinks = true,
  newTab = false,
}: {
  book: CoverBook;
  language: SiteLanguage;
  previewSources?: (string | undefined)[];
  compact?: boolean;
  /** Covers open the book's sale page; off only for a book that is not saved yet. */
  saleLinks?: boolean;
  /** The editor's preview opens the sale page in a new tab, keeping unsaved changes. */
  newTab?: boolean;
}) {
  const sale = saleLinks && Boolean(book.id);
  const buyable = saleVariants(book).length > 0;
  const saleHref = (cover?: CoverNumber) => withSiteLanguage(bookSalePath(book.id, cover), language);
  const target = newTab ? ({ target: '_blank', rel: 'noopener' } as const) : {};
  const saleLabel = (cover: string) =>
    pick(
      language,
      `Detalii și cumpărare: ${book.title} — ${cover}`,
      `Details and purchase: ${book.title} — ${cover}`,
      `Détails et achat\u00a0: ${book.title} — ${cover}`,
      `Details und Kauf: ${book.title} — ${cover}`,
      `Detalles y compra: ${book.title} — ${cover}`,
    );
  const covers = [
    { number: 1, id: book.image_id, src: previewSources[0] },
    { number: 2, id: book.image_2_id, src: previewSources[1] },
  ].filter(cover => cover.id || cover.src);
  if (!covers.length) {
    const placeholder = (
      <span className="book-cover book-cover-placeholder">
        <span>Poetio✳</span>
        <span>{book.title}</span>
        <small>{book.author}</small>
      </span>
    );
    return (
      <div className="book-covers" data-count="1">
        {sale ? (
          <a
            className="book-cover-option book-cover-link"
            href={saleHref()}
            aria-label={saleLabel(pick(language, 'copertă', 'cover', 'couverture', 'Umschlag', 'portada'))}
            {...target}
          >
            {placeholder}
          </a>
        ) : (
          placeholder
        )}
      </div>
    );
  }
  return (
    <div
      className={`book-covers${compact ? ' book-covers-compact' : ''}`}
      data-count={covers.length}
      role="group"
      aria-label={pick(
        language,
        'Coperți și achiziție',
        'Covers and purchase',
        'Couvertures et achat',
        'Umschläge und Kauf',
        'Portadas y compra',
      )}
    >
      {covers.map(cover => {
        const label = `${pick(language, 'Coperta', 'Cover', 'Couverture', 'Umschlag', 'Portada')} ${cover.number}`;
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
              {sale && (
                <span className="book-cover-buy">
                  {buyable
                    ? pick(language, 'Cumpără', 'Buy', 'Acheter', 'Kaufen', 'Comprar')
                    : pick(language, 'Detalii', 'Details', 'Détails', 'Details', 'Detalles')}
                </span>
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
              href={saleHref(cover.number as CoverNumber)}
              aria-label={saleLabel(label.toLowerCase())}
              {...target}
            >
              {content}
            </a>
          );
        return (
          <div key={cover.number} className="book-cover-option" data-cover={cover.number}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
