'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as small derivatives. */
// The products and totals of a cart or an order, as shown on the shop pages.
import type { ReactNode } from 'react';
import type { Quote, QuoteLine } from '@/db/shop';
import type { SiteLanguage } from '@/lib/poem-types';
import { bookSalePath } from '@/lib/book-sale';
import { formatMoney } from '@/lib/shop';
import { pick, withSiteLanguage } from '@/lib/site-language';

export function problemText(line: QuoteLine, language: SiteLanguage) {
  if (line.problem === 'unavailable')
    return pick(
      language,
      'Nu mai este de vânzare. Șterge-o din coș.',
      'No longer for sale. Remove it from the cart.',
      'N’est plus en vente. Retirez-le du panier.',
      'Nicht mehr erhältlich. Entfernen Sie es aus dem Warenkorb.',
    );
  if (line.problem === 'sold_out')
    return pick(language, 'Stoc epuizat.', 'Out of stock.', 'Épuisé.', 'Nicht vorrätig.');
  if (line.problem === 'too_many')
    return pick(
      language,
      `Doar ${line.stock} în stoc. Micșorează cantitatea.`,
      `Only ${line.stock} in stock. Lower the quantity.`,
      `Seulement ${line.stock} en stock. Réduisez la quantité.`,
      `Nur ${line.stock} auf Lager. Verringern Sie die Menge.`,
    );
  return '';
}

export function ShopLine({
  line,
  language,
  heading: Heading = 'h2',
  children,
}: {
  line: Pick<QuoteLine, 'book_id' | 'cover' | 'title' | 'author' | 'image_id' | 'unit_cents' | 'quantity'> &
    Partial<Pick<QuoteLine, 'problem' | 'stock'>> & { currency: string };
  language: SiteLanguage;
  heading?: 'h2' | 'h3';
  children?: ReactNode;
}) {
  const problem = line.problem ? problemText(line as QuoteLine, language) : '';
  return (
    <li className="shop-line">
      {line.image_id ? (
        <img src={`/api/images/${line.image_id}?w=320`} width={72} height={96} alt="" />
      ) : (
        <span className="shop-line-cover" aria-hidden="true" />
      )}
      <div>
        <Heading>
          <a href={withSiteLanguage(bookSalePath(line.book_id, line.cover), language)}>
            {line.title || pick(language, 'Carte', 'Book', 'Livre', 'Buch')}
          </a>
        </Heading>
        <p>
          {line.author && `${line.author} · `}
          {pick(
            language,
            `Carte tipărită, coperta ${line.cover}`,
            `Printed book, cover ${line.cover}`,
            `Livre imprimé, couverture ${line.cover}`,
            `Gedrucktes Buch, Umschlag ${line.cover}`,
          )}
        </p>
        <p>
          {formatMoney(line.unit_cents, line.currency, language)}{' '}
          {pick(language, 'bucata', 'each', 'l’unité', 'pro Stück')}
        </p>
        {problem && <p className="shop-problem">{problem}</p>}
        {children}
      </div>
      <span className="shop-line-price">{formatMoney(line.unit_cents * line.quantity, line.currency, language)}</span>
    </li>
  );
}

export function ShopTotals({
  quote,
  language,
}: {
  quote: Pick<Quote, 'currency' | 'subtotal_cents' | 'shipping_cents' | 'total_cents'> & {
    lines: { quantity: number }[];
  };
  language: SiteLanguage;
}) {
  const count = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
  const money = (cents: number) => formatMoney(cents, quote.currency, language);
  return (
    <dl>
      <div>
        <dt>
          {pick(
            language,
            `Produse (${count} ${count === 1 ? 'carte' : 'cărți'})`,
            `Items (${count} ${count === 1 ? 'book' : 'books'})`,
            `Articles (${count} ${count > 1 ? 'livres' : 'livre'})`,
            `Artikel (${count} ${count === 1 ? 'Buch' : 'Bücher'})`,
          )}
        </dt>
        <dd>{money(quote.subtotal_cents)}</dd>
      </div>
      <div>
        <dt>{pick(language, 'Livrare', 'Delivery', 'Livraison', 'Versand')}</dt>
        <dd>
          {quote.shipping_cents
            ? money(quote.shipping_cents)
            : pick(language, 'Gratuită', 'Free', 'Gratuite', 'Kostenlos')}
        </dd>
      </div>
      <div className="shop-total">
        <dt>{pick(language, 'Total', 'Order total', 'Total de la commande', 'Gesamtbetrag')}</dt>
        <dd>{money(quote.total_cents)}</dd>
      </div>
    </dl>
  );
}
