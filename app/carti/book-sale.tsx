'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as responsive derivatives. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronUp, FileText, Link2, Store } from 'lucide-react';
import type { Book } from '@/lib/book-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { bookCovers, bookSalePath, purchaseOptions, type CoverNumber } from '@/lib/book-sale';
import { bookPriceDisplay } from '@/lib/book-price';
import { responsiveImage } from '@/lib/responsive-images';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import './books.css';
import './book-sale.css';

function Price({ value, language }: { value: string | null; language: PoemLanguage }) {
  const price = bookPriceDisplay(value, language);
  if (!price) return null;
  return (
    <span className="book-sale-amount" aria-label={price.label}>
      <span aria-hidden="true">
        {price.before && <sup>{price.before}</sup>}
        {price.whole}
        {price.fraction && <sup>{price.fraction}</sup>}
        {price.after && <span className="book-sale-currency"> {price.after}</span>}
      </span>
    </span>
  );
}

export default function BookSale({
  book,
  initialLanguage,
  initialCover,
  pages,
}: {
  book: Book;
  initialLanguage: PoemLanguage;
  initialCover: CoverNumber | null;
  pages: number | null;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(initialLanguage);
  const [cover, setCover] = useState(initialCover);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const [copied, setCopied] = useState(false);
  const description = useRef<HTMLDivElement>(null);
  const ro = language === 'ro',
    copy = siteCopy[language];
  const covers = bookCovers(book);
  const options = purchaseOptions(book);
  const selected = covers.find(item => item.cover === cover) ?? covers[0];
  const option = options.find(item => item.cover === cover) ?? options[0];
  const readHref = withSiteLanguage(`/carti/${book.id}`, language);

  useEffect(() => {
    // Offer "Read more" only when the folded description actually hides text.
    const element = description.current;
    if (element && !expanded) setLong(element.scrollHeight > element.clientHeight + 1);
  }, [book.description, expanded]);

  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  function choose(next: CoverNumber) {
    setCover(next);
    window.history.replaceState(null, '', withSiteLanguage(bookSalePath(book.id, next), language));
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(withSiteLanguage(bookSalePath(book.id, cover ?? undefined), language), window.location.origin).href,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  const optionLabel = (item: (typeof options)[number]) =>
    options.length > 1 ? `${ro ? 'Coperta' : 'Cover'} ${item.cover}` : ro ? 'Carte' : 'Book';

  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
      <main id="main" className="book-sale shell" lang={language}>
        <a className="book-back" href={readHref}>
          ← {ro ? 'Înapoi la carte' : 'Back to the book'}
        </a>
        <div className="book-sale-layout">
          <header className="book-sale-heading">
            <h1 className="book-sale-title">{book.title || (ro ? 'Fără titlu' : 'Untitled')}</h1>
            <p className="book-sale-byline">
              {book.author && (
                <>
                  {ro ? 'de' : 'by'} <strong>{book.author}</strong> ({ro ? 'Autor' : 'Author'})
                  <span className="book-sale-divider" aria-hidden="true" />
                </>
              )}
              Format: <span className="book-sale-format-name">{ro ? 'Carte' : 'Book'}</span>
            </p>
          </header>
          <section className="book-sale-gallery" aria-label={ro ? 'Coperți' : 'Covers'}>
            {selected ? (
              <img
                key={selected.id}
                className="book-sale-cover"
                {...responsiveImage(`/api/images/${selected.id}`)}
                sizes="(max-width: 760px) 72vw, 300px"
                width={300}
                height={400}
                alt={`${ro ? 'Coperta' : 'Cover'} ${selected.cover}: ${book.title}`}
              />
            ) : (
              <span className="book-cover book-cover-placeholder book-sale-cover">
                <span>Poetio✳</span>
                <span>{book.title}</span>
                <small>{book.author}</small>
              </span>
            )}
            {covers.length > 1 && (
              <div className="book-sale-thumbs" role="group" aria-label={ro ? 'Alege coperta' : 'Choose a cover'}>
                {covers.map(item => (
                  <button
                    key={item.cover}
                    type="button"
                    aria-pressed={item.cover === selected?.cover}
                    aria-label={`${ro ? 'Coperta' : 'Cover'} ${item.cover}`}
                    onClick={() => choose(item.cover)}
                  >
                    <img src={`/api/images/${item.id}?w=320`} width={60} height={80} alt="" />
                  </button>
                ))}
              </div>
            )}
            <a className="book-sale-pill book-sale-sample" href={readHref}>
              {ro ? 'Citește un fragment' : 'Read sample'}
            </a>
          </section>

          <section className="book-sale-details">
            {book.description && (
              <>
                <div
                  ref={description}
                  id="book-sale-description"
                  className={`book-sale-description${expanded ? ' is-expanded' : long ? ' is-clamped' : ''}`}
                >
                  {book.description}
                </div>
                {(long || expanded) && (
                  <button
                    type="button"
                    className="book-sale-more"
                    aria-expanded={expanded}
                    aria-controls="book-sale-description"
                    onClick={() => setExpanded(value => !value)}
                  >
                    {expanded ? (
                      <ChevronUp size={16} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} aria-hidden="true" />
                    )}
                    {expanded ? (ro ? 'Citește mai puțin' : 'Read less') : ro ? 'Citește mai mult' : 'Read more'}
                  </button>
                )}
              </>
            )}
            <dl className="book-sale-facts">
              {pages && (
                <div>
                  <dt>{ro ? 'Lungime' : 'Print length'}</dt>
                  <dd>
                    <FileText size={22} aria-hidden="true" />
                    <strong>
                      {pages} {ro ? (pages === 1 ? 'pagină' : 'pagini') : pages === 1 ? 'page' : 'pages'}
                    </strong>
                  </dd>
                </div>
              )}
              <div>
                <dt>{ro ? 'Lectură' : 'Reading'}</dt>
                <dd>
                  <BookOpen size={22} aria-hidden="true" />
                  <strong>{ro ? 'Gratuit pe Poetio' : 'Free on Poetio'}</strong>
                </dd>
              </div>
              {options.length > 0 && (
                <div>
                  <dt>{ro ? 'Disponibilă la' : 'Available at'}</dt>
                  <dd>
                    <Store size={22} aria-hidden="true" />
                    <strong>{[...new Set(options.map(item => item.host))].join(', ')}</strong>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <aside className="book-sale-buy" aria-label={ro ? 'Cumpărare' : 'Purchase'}>
            {option ? (
              <>
                <div className="book-sale-formats" role="group" aria-label={ro ? 'Variante' : 'Formats'}>
                  {options.map(item => (
                    <button
                      key={item.cover}
                      type="button"
                      className="book-sale-format"
                      aria-pressed={item === option}
                      onClick={() => choose(item.cover)}
                    >
                      <span>{optionLabel(item)}</span>
                      <strong>{item.price ? (bookPriceDisplay(item.price, language)?.label ?? '') : item.host}</strong>
                    </button>
                  ))}
                </div>
                <div className="book-sale-price-line">
                  {option.price ? (
                    <Price value={option.price} language={language} />
                  ) : (
                    <span className="book-sale-no-price">
                      {ro ? `Prețul este afișat pe ${option.host}` : `The price is shown on ${option.host}`}
                    </span>
                  )}
                </div>
                <p className="book-sale-note">
                  {ro
                    ? `Livrarea, taxele și disponibilitatea sunt afișate pe ${option.host}, la comandă.`
                    : `Delivery, taxes and availability are shown on ${option.host} when you order.`}
                </p>
                <a
                  className="book-sale-pill book-sale-buy-now"
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ro ? 'Cumpără acum' : 'Buy now'}
                  <span className="sr-only">
                    {ro ? ` pe ${option.host} (filă nouă)` : ` on ${option.host} (new tab)`}
                  </span>
                </a>
                <a className="book-sale-pill book-sale-read" href={readHref}>
                  {ro ? 'Citește gratuit pe Poetio' : 'Read free on Poetio'}
                </a>
                <dl className="book-sale-terms">
                  <div>
                    <dt>{ro ? 'Vânzător' : 'Seller'}</dt>
                    <dd>{option.host}</dd>
                  </div>
                  <div>
                    <dt>{ro ? 'Plată' : 'Payment'}</dt>
                    <dd>{ro ? 'Securizată, în magazin' : 'Secure, at the store'}</dd>
                  </div>
                  <div>
                    <dt>{ro ? 'Lectură' : 'Reading'}</dt>
                    <dd>{ro ? 'Gratuit pe Poetio' : 'Free on Poetio'}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="book-sale-no-price">
                  {ro ? 'Cartea nu se vinde încă online.' : 'This book is not sold online yet.'}
                </p>
                <p className="book-sale-note">
                  {ro ? 'O poți citi gratuit pe Poetio.' : 'You can read it free on Poetio.'}
                </p>
                <a className="book-sale-pill book-sale-buy-now" href={readHref}>
                  {ro ? 'Citește gratuit pe Poetio' : 'Read free on Poetio'}
                </a>
              </>
            )}
            <button type="button" className="book-sale-share" onClick={() => void copyLink()}>
              <Link2 size={18} aria-hidden="true" />
              {ro ? 'Copiază linkul' : 'Copy link'}
            </button>
            <span role="status" className="book-sale-status">
              {copied ? (ro ? 'Link copiat.' : 'Link copied.') : ''}
            </span>
          </aside>
        </div>
      </main>
      <footer className="site-footer shell">
        <a href={withSiteLanguage('/', language)} className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <p>{copy.footer}</p>
        <a href="#" className="back-top">
          {copy.back} ↑
        </a>
      </footer>
    </>
  );
}
