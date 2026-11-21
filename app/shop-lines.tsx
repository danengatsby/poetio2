'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as small derivatives. */
// The products and totals of a cart or an order, as shown on the shop pages.
import type { ReactNode } from 'react';
import type { Quote, QuoteLine } from '@/db/shop';
import type { PoemLanguage } from '@/lib/poem-types';
import { bookSalePath } from '@/lib/book-sale';
import { formatMoney } from '@/lib/shop';
import { withSiteLanguage } from '@/lib/site-language';

export function problemText(line: QuoteLine, language: PoemLanguage) {
  const ro = language === 'ro';
  if (line.problem === 'unavailable')
    return ro ? 'Nu mai este de vânzare. Șterge-o din coș.' : 'No longer for sale. Remove it from the cart.';
  if (line.problem === 'sold_out') return ro ? 'Stoc epuizat.' : 'Out of stock.';
  if (line.problem === 'too_many')
    return ro
      ? `Doar ${line.stock} în stoc. Micșorează cantitatea.`
      : `Only ${line.stock} in stock. Lower the quantity.`;
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
  language: PoemLanguage;
  heading?: 'h2' | 'h3';
  children?: ReactNode;
}) {
  const ro = language === 'ro';
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
            {line.title || (ro ? 'Carte' : 'Book')}
          </a>
        </Heading>
        <p>
          {line.author && `${line.author} · `}
          {ro ? `Carte tipărită, coperta ${line.cover}` : `Printed book, cover ${line.cover}`}
        </p>
        <p>
          {formatMoney(line.unit_cents, line.currency, language)} {ro ? 'bucata' : 'each'}
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
  language: PoemLanguage;
}) {
  const ro = language === 'ro';
  const count = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
  const money = (cents: number) => formatMoney(cents, quote.currency, language);
  return (
    <dl>
      <div>
        <dt>
          {ro
            ? `Produse (${count} ${count === 1 ? 'carte' : 'cărți'})`
            : `Items (${count} ${count === 1 ? 'book' : 'books'})`}
        </dt>
        <dd>{money(quote.subtotal_cents)}</dd>
      </div>
      <div>
        <dt>{ro ? 'Livrare' : 'Delivery'}</dt>
        <dd>{quote.shipping_cents ? money(quote.shipping_cents) : ro ? 'Gratuită' : 'Free'}</dd>
      </div>
      <div className="shop-total">
        <dt>{ro ? 'Total' : 'Order total'}</dt>
        <dd>{money(quote.total_cents)}</dd>
      </div>
    </dl>
  );
}
