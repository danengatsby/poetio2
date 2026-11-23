'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as responsive derivatives. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronUp, FileText, Languages, Link2 } from 'lucide-react';
import type { Book } from '@/lib/book-types';
import type { SiteLanguage } from '@/lib/poem-types';
import { bookCovers, bookSalePath, saleVariants, type CoverNumber } from '@/lib/book-sale';
import { addToCart } from '@/lib/cart';
import { BOOK_LANGUAGES, MAX_ITEM_QUANTITY, amountCents, formatMoney, paymentLabel, type PublicShop } from '@/lib/shop';
import { bookPriceDisplay } from '@/lib/book-price';
import { responsiveImage } from '@/lib/responsive-images';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import { CartLink } from '../shop-frame';
import './books.css';
import './book-sale.css';
import LegalLinks from '../legal-links';

function Price({ value, language }: { value: string | null; language: SiteLanguage }) {
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
  initialLanguage: SiteLanguage;
  initialCover: CoverNumber | null;
  pages: number | null;
  shop: PublicShop;
  /** Copies left; null when the stock is not counted. */
  stock: number | null;
  bookLanguage: string;
  /** Estimated delivery dates, already worked out on the server for both languages. */
  delivery: Record<SiteLanguage, string>;
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
  const copy = siteCopy[language];
  const covers = bookCovers(book);
  // Only prices in the shop's currency can be ordered.
  const variants = saleVariants(book).filter(item => item.price.endsWith(` ${shop.currency}`));
  const selected = covers.find(item => item.cover === cover) ?? covers[0];
  const variant = variants.find(item => item.cover === cover) ?? variants[0];
  const orderable = shop.ready && Boolean(variant);
  const soldOut = stock === 0;
  const maxQuantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, stock ?? MAX_ITEM_QUANTITY));
  const shipping = amountCents(shop.shipping_amount) ?? 0;
  const bookLanguageName = BOOK_LANGUAGES[bookLanguage]?.[pick(language, 'ro', 'en', 'fr', 'de', 'es', 'it')];
  const readHref = withSiteLanguage(`/carti/${book.id}`, language);

  useEffect(() => {
    // Offer "Read more" only when the folded description actually hides text.
    const element = description.current;
    if (element && !expanded) setLong(element.scrollHeight > element.clientHeight + 1);
  }, [book.description, expanded]);

  function changeLanguage(value: SiteLanguage) {
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
    variants.length > 1
      ? `${pick(language, 'Coperta', 'Cover', 'Couverture', 'Umschlag', 'Portada', 'Copertina')} ${item.cover}`
      : pick(
          language,
          'Carte tipărită',
          'Printed book',
          'Livre imprimé',
          'Gedrucktes Buch',
          'Libro impreso',
          'Libro stampato',
        );
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
    ? {
        className: 'shop-stock-out',
        text: pick(language, 'Stoc epuizat', 'Out of stock', 'Épuisé', 'Nicht vorrätig', 'Agotado', 'Esaurito'),
      }
    : stock !== null && stock <= 5
      ? {
          className: 'shop-stock-low',
          text: pick(
            language,
            `Doar ${stock} ${stock === 1 ? 'exemplar' : 'exemplare'} în stoc`,
            `Only ${stock} left in stock`,
            `Plus que ${stock} en stock`,
            `Nur noch ${stock} auf Lager`,
            `Solo quedan ${stock} en existencias`,
            `Solo ${stock} disponibili`,
          ),
        }
      : {
          className: 'shop-stock-in',
          text: pick(language, 'În stoc', 'In stock', 'En stock', 'Auf Lager', 'En existencias', 'Disponibile'),
        };

  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
      <main id="main" className="book-sale shell" lang={language}>
        <div className="shop-bar">
          <a className="book-back" href={readHref}>
            ←{' '}
            {pick(
              language,
              'Înapoi la carte',
              'Back to the book',
              'Retour au livre',
              'Zurück zum Buch',
              'Volver al libro',
              'Torna al libro',
            )}
          </a>
          <CartLink language={language} />
        </div>
        <div className="book-sale-layout">
          <header className="book-sale-heading">
            <h1 className="book-sale-title">
              {book.title ||
                pick(language, 'Fără titlu', 'Untitled', 'Sans titre', 'Ohne Titel', 'Sin título', 'Senza titolo')}
            </h1>
            <p className="book-sale-byline">
              {book.author && (
                <>
                  {pick(language, 'de', 'by', 'de', 'von', 'de', 'di')} <strong>{book.author}</strong> (
                  {pick(language, 'Autor', 'Author', 'Auteur', 'Autor', 'Autor', 'Autore')})
                  <span className="book-sale-divider" aria-hidden="true" />
                </>
              )}
              Format:{' '}
              <span className="book-sale-format-name">
                {pick(
                  language,
                  'Carte tipărită',
                  'Printed book',
                  'Livre imprimé',
                  'Gedrucktes Buch',
                  'Libro impreso',
                  'Libro stampato',
                )}
              </span>
            </p>
          </header>
          <section
            className="book-sale-gallery"
            aria-label={pick(language, 'Coperți', 'Covers', 'Couvertures', 'Umschläge', 'Portadas', 'Copertine')}
          >
            {selected ? (
              <img
                key={selected.id}
                className="book-sale-cover"
                {...responsiveImage(`/api/images/${selected.id}`)}
                sizes="(max-width: 760px) 72vw, 300px"
                width={300}
                height={400}
                alt={`${pick(language, 'Coperta', 'Cover', 'Couverture', 'Umschlag', 'Portada', 'Copertina')} ${selected.cover}: ${book.title}`}
              />
            ) : (
              <span className="book-cover book-cover-placeholder book-sale-cover">
                <span>Poetio✳</span>
                <span>{book.title}</span>
                <small>{book.author}</small>
              </span>
            )}
            {covers.length > 1 && (
              <div
                className="book-sale-thumbs"
                role="group"
                aria-label={pick(
                  language,
                  'Alege coperta',
                  'Choose a cover',
                  'Choisissez une couverture',
                  'Wählen Sie einen Umschlag',
                  'Elige una portada',
                  'Scegli una copertina',
                )}
              >
                {covers.map(item => (
                  <button
                    key={item.cover}
                    type="button"
                    aria-pressed={item.cover === selected?.cover}
                    aria-label={`${pick(language, 'Coperta', 'Cover', 'Couverture', 'Umschlag', 'Portada', 'Copertina')} ${item.cover}`}
                    onClick={() => choose(item.cover)}
                  >
                    <img src={`/api/images/${item.id}?w=320`} width={60} height={80} alt="" />
                  </button>
                ))}
              </div>
            )}
            <a className="book-sale-pill book-sale-sample" href={readHref}>
              {pick(
                language,
                'Citește un fragment',
                'Read sample',
                'Lire un extrait',
                'Leseprobe',
                'Leer un fragmento',
                'Leggi un estratto',
              )}
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
                    {expanded
                      ? pick(
                          language,
                          'Citește mai puțin',
                          'Read less',
                          'Réduire',
                          'Weniger anzeigen',
                          'Leer menos',
                          'Mostra meno',
                        )
                      : pick(
                          language,
                          'Citește mai mult',
                          'Read more',
                          'Lire la suite',
                          'Mehr lesen',
                          'Leer más',
                          'Leggi tutto',
                        )}
                  </button>
                )}
              </>
            )}
            <dl className="book-sale-facts">
              {pages && (
                <div>
                  <dt>
                    {pick(
                      language,
                      'Lungime',
                      'Print length',
                      'Nombre de pages',
                      'Seitenzahl',
                      'Número de páginas',
                      'Numero di pagine',
                    )}
                  </dt>
                  <dd>
                    <FileText size={22} aria-hidden="true" />
                    <strong>
                      {pages}{' '}
                      {pick(
                        language,
                        pages === 1 ? 'pagină' : 'pagini',
                        pages === 1 ? 'page' : 'pages',
                        pages > 1 ? 'pages' : 'page',
                        pages === 1 ? 'Seite' : 'Seiten',
                        pages === 1 ? 'página' : 'páginas',
                        pages === 1 ? 'pagina' : 'pagine',
                      )}
                    </strong>
                  </dd>
                </div>
              )}
              <div>
                <dt>{pick(language, 'Lectură', 'Reading', 'Lecture', 'Lesen', 'Lectura', 'Lettura')}</dt>
                <dd>
                  <BookOpen size={22} aria-hidden="true" />
                  <strong>
                    {pick(
                      language,
                      'Gratuit pe Poetio',
                      'Free on Poetio',
                      'Gratuit sur Poetio',
                      'Kostenlos auf Poetio',
                      'Gratis en Poetio',
                      'Gratis su Poetio',
                    )}
                  </strong>
                </dd>
              </div>
              {bookLanguageName && (
                <div>
                  <dt>{pick(language, 'Limba', 'Language', 'Langue', 'Sprache', 'Idioma', 'Lingua')}</dt>
                  <dd>
                    <Languages size={22} aria-hidden="true" />
                    <strong>{bookLanguageName}</strong>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <aside
            className="book-sale-buy"
            aria-label={pick(language, 'Cumpărare', 'Purchase', 'Achat', 'Kauf', 'Compra', 'Acquisto')}
          >
            {variant ? (
              <>
                <div
                  className="book-sale-formats"
                  role="group"
                  aria-label={pick(language, 'Variante', 'Formats', 'Formats', 'Formate', 'Formatos', 'Formati')}
                >
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
                {pick(
                  language,
                  'Cartea nu este încă de vânzare.',
                  'This book is not for sale yet.',
                  'Ce livre n’est pas encore en vente.',
                  'Dieses Buch ist noch nicht erhältlich.',
                  'Este libro aún no está a la venta.',
                  'Questo libro non è ancora in vendita.',
                )}
              </p>
            )}
            {orderable ? (
              <>
                <p className="book-sale-shipping">
                  {shipping
                    ? pick(
                        language,
                        `+ ${formatMoney(shipping, shop.currency, language)} livrare`,
                        `+ ${formatMoney(shipping, shop.currency, language)} delivery`,
                        `+ ${formatMoney(shipping, shop.currency, language)} de livraison`,
                        `+ ${formatMoney(shipping, shop.currency, language)} Versand`,
                        `+ ${formatMoney(shipping, shop.currency, language)} de envío`,
                        `+ ${formatMoney(shipping, shop.currency, language)} di spedizione`,
                      )
                    : pick(
                        language,
                        'Livrare gratuită',
                        'Free delivery',
                        'Livraison gratuite',
                        'Kostenloser Versand',
                        'Envío gratuito',
                        'Spedizione gratuita',
                      )}
                </p>
                {!soldOut && (
                  <p className="book-sale-delivery">
                    {pick(
                      language,
                      'Livrare estimată: ',
                      'Estimated delivery: ',
                      'Livraison estimée\u00a0: ',
                      'Voraussichtliche Lieferung: ',
                      'Entrega estimada: ',
                      'Consegna prevista: ',
                    )}
                    <strong>{delivery[language]}</strong>
                  </p>
                )}
                <p className={`shop-stock ${stockLine.className}`}>{stockLine.text}</p>
                {!soldOut && (
                  <label className="shop-quantity">
                    {pick(language, 'Cantitate:', 'Quantity:', 'Quantité\u00a0:', 'Menge:', 'Cantidad:', 'Quantità:')}
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
                  {pick(
                    language,
                    'Adaugă în coș',
                    'Add to cart',
                    'Ajouter au panier',
                    'In den Warenkorb',
                    'Añadir al carrito',
                    'Aggiungi al carrello',
                  )}
                </button>
                {soldOut ? (
                  <button type="button" className="shop-button shop-button-orange" disabled>
                    {pick(
                      language,
                      'Cumpără acum',
                      'Buy now',
                      'Acheter maintenant',
                      'Jetzt kaufen',
                      'Comprar ahora',
                      'Acquista ora',
                    )}
                  </button>
                ) : (
                  <a className="shop-button shop-button-orange" href={buyNowHref}>
                    {pick(
                      language,
                      'Cumpără acum',
                      'Buy now',
                      'Acheter maintenant',
                      'Jetzt kaufen',
                      'Comprar ahora',
                      'Acquista ora',
                    )}
                  </a>
                )}
                <p role="status" className="shop-status">
                  {added && (
                    <>
                      {pick(
                        language,
                        'Adăugat în coș. ',
                        'Added to cart. ',
                        'Ajouté au panier. ',
                        'In den Warenkorb gelegt. ',
                        'Añadido al carrito. ',
                        'Aggiunto al carrello. ',
                      )}
                      <a href={withSiteLanguage('/cos', language)}>
                        {pick(
                          language,
                          'Vezi coșul',
                          'View cart',
                          'Voir le panier',
                          'Warenkorb ansehen',
                          'Ver carrito',
                          'Vedi il carrello',
                        )}
                      </a>
                    </>
                  )}
                </p>
                <dl className="book-sale-terms">
                  <div>
                    <dt>
                      {pick(
                        language,
                        'Expediat de',
                        'Ships from',
                        'Expédié depuis',
                        'Versand aus',
                        'Enviado desde',
                        'Spedito da',
                      )}
                    </dt>
                    <dd>{shop.seller_name}</dd>
                  </div>
                  <div>
                    <dt>
                      {pick(language, 'Vândut de', 'Sold by', 'Vendu par', 'Verkauft von', 'Vendido por', 'Venduto da')}
                    </dt>
                    <dd>{shop.seller_name}</dd>
                  </div>
                  <div>
                    <dt>{pick(language, 'Retur', 'Returns', 'Retours', 'Rückgabe', 'Devoluciones', 'Resi')}</dt>
                    <dd>
                      <a href={withSiteLanguage('/termeni#retur', language)}>
                        {pick(
                          language,
                          '14 zile de la primire',
                          'Within 14 days of receipt',
                          'Sous 14\u00a0jours après réception',
                          'Innerhalb von 14 Tagen nach Erhalt',
                          'En los 14 días siguientes a la recepción',
                          'Entro 14 giorni dal ricevimento',
                        )}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{pick(language, 'Plată', 'Payment', 'Paiement', 'Zahlung', 'Pago', 'Pagamento')}</dt>
                    <dd>{shop.payment_methods.map(method => paymentLabel(method, language)).join(' · ')}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <>
                <p className="book-sale-note">
                  {variant
                    ? pick(
                        language,
                        'Comenzile online se deschid în curând.',
                        'Online orders open soon.',
                        'Les commandes en ligne ouvrent bientôt.',
                        'Online-Bestellungen sind bald möglich.',
                        'Los pedidos en línea abrirán pronto.',
                        'Gli ordini online apriranno presto.',
                      )
                    : pick(
                        language,
                        'O poți citi gratuit pe Poetio.',
                        'You can read it free on Poetio.',
                        'Vous pouvez le lire gratuitement sur Poetio.',
                        'Sie können es kostenlos auf Poetio lesen.',
                        'Puedes leerlo gratis en Poetio.',
                        'Puoi leggerlo gratis su Poetio.',
                      )}
                </p>
                <a className="book-sale-pill book-sale-read" href={readHref}>
                  {pick(
                    language,
                    'Citește gratuit pe Poetio',
                    'Read free on Poetio',
                    'Lire gratuitement sur Poetio',
                    'Kostenlos auf Poetio lesen',
                    'Leer gratis en Poetio',
                    'Leggi gratis su Poetio',
                  )}
                </a>
              </>
            )}
            <button type="button" className="book-sale-share" onClick={() => void copyLink()}>
              <Link2 size={18} aria-hidden="true" />
              {pick(
                language,
                'Copiază linkul',
                'Copy link',
                'Copier le lien',
                'Link kopieren',
                'Copiar enlace',
                'Copia il link',
              )}
            </button>
            <span role="status" className="book-sale-status">
              {copied
                ? pick(
                    language,
                    'Link copiat.',
                    'Link copied.',
                    'Lien copié.',
                    'Link kopiert.',
                    'Enlace copiado.',
                    'Link copiato.',
                  )
                : ''}
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
