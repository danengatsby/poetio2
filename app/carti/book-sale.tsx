'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as responsive derivatives. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronUp, FileText, Languages, Link2 } from 'lucide-react';
import type { Book } from '@/lib/book-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { bookCovers, bookSalePath, saleVariants, type CoverNumber } from '@/lib/book-sale';
import { addToCart } from '@/lib/cart';
import { BOOK_LANGUAGES, MAX_ITEM_QUANTITY, amountCents, formatMoney, paymentLabel, type PublicShop } from '@/lib/shop';
import { bookPriceDisplay } from '@/lib/book-price';
import { responsiveImage } from '@/lib/responsive-images';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import { CartLink } from '../shop-frame';
import './books.css';
import './book-sale.css';
import LegalLinks from '../legal-links';

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
  shop,
  stock,
  bookLanguage,
  delivery,
}: {
  book: Book;
  initialLanguage: PoemLanguage;
  initialCover: CoverNumber | null;
  pages: number | null;
  shop: PublicShop;
  /** Copies left; null when the stock is not counted. */
  stock: number | null;
  bookLanguage: string;
  /** Estimated delivery dates, already worked out on the server for both languages. */
  delivery: Record<PoemLanguage, string>;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(initialLanguage);
  const [cover, setCover] = useState(initialCover);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const description = useRef<HTMLDivElement>(null);
  const ro = language === 'ro',
    copy = siteCopy[language];
  const covers = bookCovers(book);
  // Only prices in the shop's currency can be ordered.
  const variants = saleVariants(book).filter(item => item.price.endsWith(` ${shop.currency}`));
  const selected = covers.find(item => item.cover === cover) ?? covers[0];
  const variant = variants.find(item => item.cover === cover) ?? variants[0];
  const orderable = shop.ready && Boolean(variant);
  const soldOut = stock === 0;
  const maxQuantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, stock ?? MAX_ITEM_QUANTITY));
  const shipping = amountCents(shop.shipping_amount) ?? 0;
  const bookLanguageName = BOOK_LANGUAGES[bookLanguage]?.[ro ? 'ro' : 'en'];
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
    setAdded(false);
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
  const variantLabel = (item: (typeof variants)[number]) =>
    variants.length > 1 ? `${ro ? 'Coperta' : 'Cover'} ${item.cover}` : ro ? 'Carte tipărită' : 'Printed book';
  function add() {
    if (!variant) return;
    addToCart({ book_id: book.id, cover: variant.cover, quantity });
    setAdded(true);
  }
  const buyNowHref = variant
    ? withSiteLanguage(
        `/comanda?carte=${encodeURIComponent(book.id)}&coperta=${variant.cover}&cantitate=${quantity}`,
        language,
      )
    : '#';
  const stockLine = soldOut
    ? { className: 'shop-stock-out', text: ro ? 'Stoc epuizat' : 'Out of stock' }
    : stock !== null && stock <= 5
      ? {
          className: 'shop-stock-low',
          text: ro ? `Doar ${stock} ${stock === 1 ? 'exemplar' : 'exemplare'} în stoc` : `Only ${stock} left in stock`,
        }
      : { className: 'shop-stock-in', text: ro ? 'În stoc' : 'In stock' };

  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
      <main id="main" className="book-sale shell" lang={language}>
        <div className="shop-bar">
          <a className="book-back" href={readHref}>
            ← {ro ? 'Înapoi la carte' : 'Back to the book'}
          </a>
          <CartLink language={language} />
        </div>
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
              Format: <span className="book-sale-format-name">{ro ? 'Carte tipărită' : 'Printed book'}</span>
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
              {bookLanguageName && (
                <div>
                  <dt>{ro ? 'Limba' : 'Language'}</dt>
                  <dd>
                    <Languages size={22} aria-hidden="true" />
                    <strong>{bookLanguageName}</strong>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <aside className="book-sale-buy" aria-label={ro ? 'Cumpărare' : 'Purchase'}>
            {variant ? (
              <>
                <div className="book-sale-formats" role="group" aria-label={ro ? 'Variante' : 'Formats'}>
                  {variants.map(item => (
                    <button
                      key={item.cover}
                      type="button"
                      className="book-sale-format"
                      aria-pressed={item === variant}
                      onClick={() => choose(item.cover)}
                    >
                      <span>{variantLabel(item)}</span>
                      <strong>{bookPriceDisplay(item.price, language)?.label}</strong>
                    </button>
                  ))}
                </div>
                <div className="book-sale-price-line">
                  <Price value={variant.price} language={language} />
                </div>
              </>
            ) : (
              <p className="book-sale-no-price">
                {ro ? 'Cartea nu este încă de vânzare.' : 'This book is not for sale yet.'}
              </p>
            )}
            {orderable ? (
              <>
                <p className="book-sale-shipping">
                  {shipping
                    ? ro
                      ? `+ ${formatMoney(shipping, shop.currency, language)} livrare`
                      : `+ ${formatMoney(shipping, shop.currency, language)} delivery`
                    : ro
                      ? 'Livrare gratuită'
                      : 'Free delivery'}
                </p>
                {!soldOut && (
                  <p className="book-sale-delivery">
                    {ro ? 'Livrare estimată: ' : 'Estimated delivery: '}
                    <strong>{delivery[language]}</strong>
                  </p>
                )}
                <p className={`shop-stock ${stockLine.className}`}>{stockLine.text}</p>
                {!soldOut && (
                  <label className="shop-quantity">
                    {ro ? 'Cantitate:' : 'Quantity:'}
                    <select
                      value={quantity}
                      onChange={event => {
                        setQuantity(Number(event.target.value));
                        setAdded(false);
                      }}
                    >
                      {Array.from({ length: maxQuantity }, (_, index) => index + 1).map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button type="button" className="shop-button" disabled={soldOut} onClick={add}>
                  {ro ? 'Adaugă în coș' : 'Add to cart'}
                </button>
                {soldOut ? (
                  <button type="button" className="shop-button shop-button-orange" disabled>
                    {ro ? 'Cumpără acum' : 'Buy now'}
                  </button>
                ) : (
                  <a className="shop-button shop-button-orange" href={buyNowHref}>
                    {ro ? 'Cumpără acum' : 'Buy now'}
                  </a>
                )}
                <p role="status" className="shop-status">
                  {added && (
                    <>
                      {ro ? 'Adăugat în coș. ' : 'Added to cart. '}
                      <a href={withSiteLanguage('/cos', language)}>{ro ? 'Vezi coșul' : 'View cart'}</a>
                    </>
                  )}
                </p>
                <dl className="book-sale-terms">
                  <div>
                    <dt>{ro ? 'Expediat de' : 'Ships from'}</dt>
                    <dd>{shop.seller_name}</dd>
                  </div>
                  <div>
                    <dt>{ro ? 'Vândut de' : 'Sold by'}</dt>
                    <dd>{shop.seller_name}</dd>
                  </div>
                  <div>
                    <dt>{ro ? 'Retur' : 'Returns'}</dt>
                    <dd>
                      <a href={withSiteLanguage('/termeni#retur', language)}>
                        {ro ? '14 zile de la primire' : 'Within 14 days of receipt'}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{ro ? 'Plată' : 'Payment'}</dt>
                    <dd>{shop.payment_methods.map(method => paymentLabel(method, language)).join(' · ')}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="book-sale-note">
                  {variant
                    ? ro
                      ? 'Comenzile online se deschid în curând.'
                      : 'Online orders open soon.'
                    : ro
                      ? 'O poți citi gratuit pe Poetio.'
                      : 'You can read it free on Poetio.'}
                </p>
                <a className="book-sale-pill book-sale-read" href={readHref}>
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
        <p>
          {copy.footer} · <LegalLinks language={language} />
        </p>
        <a href="#" className="back-top">
          {copy.back} ↑
        </a>
      </footer>
    </>
  );
}
