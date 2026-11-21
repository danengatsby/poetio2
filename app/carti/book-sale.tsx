'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as responsive derivatives. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, Link2, Store } from 'lucide-react';
import type { Book } from '@/lib/book-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { bookCovers, bookSalePath, purchaseOptions, type CoverNumber } from '@/lib/book-sale';
import { responsiveImage } from '@/lib/responsive-images';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import './books.css';
import './book-sale.css';

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
  const readHref = withSiteLanguage(`/carti/${book.id}`, language);

  useEffect(() => {
    // Offer "Read more" only when the clamped description actually hides text.
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
        new URL(withSiteLanguage(bookSalePath(book.id, selected?.cover), language), window.location.origin).href,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

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
          <section className="book-sale-gallery" aria-label={ro ? 'Coperți' : 'Covers'}>
            {selected ? (
              <img
                key={selected.id}
                className="book-sale-cover"
                {...responsiveImage(`/api/images/${selected.id}`)}
                sizes="(max-width: 760px) 72vw, 320px"
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
            <a className="secondary-button book-sale-sample" href={readHref}>
              {ro ? 'Citește un fragment' : 'Read a sample'}
            </a>
          </section>

          <section className="book-sale-details">
            <h1>{book.title || (ro ? 'Fără titlu' : 'Untitled')}</h1>
            {book.author && (
              <p className="book-sale-byline">
                {ro ? 'de' : 'by'} <strong>{book.author}</strong> ({ro ? 'Autor' : 'Author'})
              </p>
            )}
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
                    className="text-button book-sale-more"
                    aria-expanded={expanded}
                    aria-controls="book-sale-description"
                    onClick={() => setExpanded(value => !value)}
                  >
                    {expanded ? (ro ? 'Citește mai puțin' : 'Read less') : ro ? 'Citește mai mult' : 'Read more'}
                  </button>
                )}
              </>
            )}
            <dl className="book-sale-facts">
              {pages && (
                <div>
                  <dt>
                    <FileText size={20} aria-hidden="true" />
                    {ro ? 'Lungime' : 'Length'}
                  </dt>
                  <dd>
                    {pages} {ro ? (pages === 1 ? 'pagină' : 'pagini') : pages === 1 ? 'page' : 'pages'}
                  </dd>
                </div>
              )}
              <div>
                <dt>
                  <BookOpen size={20} aria-hidden="true" />
                  {ro ? 'Lectură' : 'Reading'}
                </dt>
                <dd>{ro ? 'Gratuit pe Poetio' : 'Free on Poetio'}</dd>
              </div>
              {options.length > 0 && (
                <div>
                  <dt>
                    <Store size={20} aria-hidden="true" />
                    {ro ? 'Disponibilă la' : 'Available at'}
                  </dt>
                  <dd>{[...new Set(options.map(option => option.host))].join(', ')}</dd>
                </div>
              )}
            </dl>
          </section>

          <aside className="book-sale-buy" aria-label={ro ? 'Cumpărare' : 'Purchase'}>
            <h2>{ro ? 'Cumpără cartea' : 'Buy the book'}</h2>
            {options.length ? (
              <>
                {options.map(option => (
                  <div
                    key={option.cover}
                    className={`book-sale-option${options.length > 1 && option.cover === selected?.cover ? ' is-selected' : ''}`}
                  >
                    {options.length > 1 && (
                      <p className="book-sale-option-label">
                        {ro ? 'Varianta cu coperta' : 'Edition with cover'} {option.cover}
                      </p>
                    )}
                    <a
                      className="primary-button book-sale-buy-link"
                      href={option.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ro ? 'Cumpără pe' : 'Buy on'} {option.host} <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                ))}
                <p className="book-sale-note">
                  {ro
                    ? 'Magazinul se deschide într-o filă nouă. Prețul, livrarea și plata sunt afișate acolo.'
                    : 'The store opens in a new tab. Price, delivery and payment are shown there.'}
                </p>
              </>
            ) : (
              <p className="book-sale-note">
                {ro
                  ? 'Cartea nu are încă un link de cumpărare. O poți citi pe Poetio.'
                  : 'This book has no purchase link yet. You can read it on Poetio.'}
              </p>
            )}
            <a className="secondary-button" href={readHref}>
              {ro ? 'Citește pe Poetio' : 'Read on Poetio'}
            </a>
            <button type="button" className="text-button book-sale-share" onClick={() => void copyLink()}>
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
