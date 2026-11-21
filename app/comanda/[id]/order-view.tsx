'use client';
import type { Order } from '@/db/shop';
import type { PoemLanguage } from '@/lib/poem-types';
import { formatMoney, paymentLabel, statusLabel, type OrderStatus, type PublicShop } from '@/lib/shop';
import { withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../../shop-frame';
import { ShopLine, ShopTotals } from '../../shop-lines';

const englishStatus: Record<OrderStatus, string> = {
  new: 'Received',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrderView({
  initialLanguage,
  order,
  shop,
  delivery,
}: {
  initialLanguage: PoemLanguage;
  order: Order;
  shop: PublicShop;
  delivery: Record<PoemLanguage, string>;
}) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
  const money = (cents: number) => formatMoney(cents, order.currency, language);
  const open = order.status === 'new' || order.status === 'confirmed';
  const placed = new Intl.DateTimeFormat(ro ? 'ro-RO' : 'en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(order.created_at);
  const lines = order.items.map(item => ({
    ...item,
    cover: item.cover === 2 ? (2 as const) : (1 as const),
    author: '',
    currency: order.currency,
  }));

  return (
    <ShopFrame language={language} onLanguageChange={changeLanguage}>
      <div className="shop-document">
        {order.status === 'cancelled' ? (
          <p className="shop-alert" role="status">
            {ro ? `Comanda nr. ${order.number} a fost anulată.` : `Order no. ${order.number} was cancelled.`}
          </p>
        ) : (
          <p className="shop-alert shop-ok" role="status">
            {ro
              ? `Mulțumim! Comanda nr. ${order.number} a fost înregistrată.`
              : `Thank you! Order no. ${order.number} has been placed.`}
          </p>
        )}
        <h1 className="shop-title">{ro ? `Comanda nr. ${order.number}` : `Order no. ${order.number}`}</h1>
        <dl className="shop-details">
          <dt>{ro ? 'Plasată' : 'Placed'}</dt>
          <dd>{placed}</dd>
          <dt>{ro ? 'Stare' : 'Status'}</dt>
          <dd>
            <strong>{ro ? statusLabel[order.status] : englishStatus[order.status]}</strong>
          </dd>
          {open && (
            <>
              <dt>{ro ? 'Livrare estimată' : 'Estimated delivery'}</dt>
              <dd>
                {delivery[language]}
                {order.payment_method === 'transfer' &&
                  (ro ? ' (după primirea plății)' : ' (after the payment arrives)')}
              </dd>
            </>
          )}
          <dt>{ro ? 'Plată' : 'Payment'}</dt>
          <dd>{paymentLabel(order.payment_method, language)}</dd>
        </dl>
        <p className="shop-note">
          {ro
            ? 'Păstrează linkul acestei pagini: îl poți deschide oricând pentru a vedea starea comenzii.'
            : 'Keep the link to this page: you can open it any time to see the status of your order.'}
        </p>

        {open && order.payment_method === 'transfer' && (
          <section className="shop-panel" aria-labelledby="payment-title">
            <h2 id="payment-title">{ro ? 'Plata prin transfer bancar' : 'Bank transfer'}</h2>
            <dl className="shop-details">
              <dt>{ro ? 'Beneficiar' : 'Beneficiary'}</dt>
              <dd>{shop.transfer_beneficiary || shop.seller_name}</dd>
              <dt>IBAN</dt>
              <dd className="shop-iban">{shop.transfer_iban.replace(/(.{4})/g, '$1 ').trim()}</dd>
              {shop.transfer_bank && (
                <>
                  <dt>{ro ? 'Banca' : 'Bank'}</dt>
                  <dd>{shop.transfer_bank}</dd>
                </>
              )}
              <dt>{ro ? 'Suma' : 'Amount'}</dt>
              <dd>
                <strong>{money(order.total_cents)}</strong>
              </dd>
              <dt>{ro ? 'Detalii plată' : 'Reference'}</dt>
              <dd>{ro ? `Comanda ${order.number}` : `Order ${order.number}`}</dd>
            </dl>
            <p className="shop-note">
              {ro
                ? 'Expediem cărțile după ce plata ajunge în cont.'
                : 'We ship the books once the payment reaches the account.'}
            </p>
          </section>
        )}
        {open && order.payment_method === 'cod' && (
          <p>
            {ro
              ? `Plătești ${money(order.total_cents)} curierului, când primești coletul.`
              : `You pay ${money(order.total_cents)} to the courier when the parcel arrives.`}
          </p>
        )}

        <h2>{ro ? 'Produse' : 'Items'}</h2>
        <ul className="shop-lines">
          {lines.map(line => (
            <ShopLine key={`${line.book_id}:${line.cover}`} line={line} language={language} heading="h3" />
          ))}
        </ul>
        <div className="shop-summary shop-panel">
          <ShopTotals quote={{ ...order, lines }} language={language} />
        </div>

        <h2>{ro ? 'Livrare la' : 'Delivery to'}</h2>
        <p>
          {order.customer_name}
          <br />
          {order.address}
          <br />
          {[order.city, order.county, order.postal_code].filter(Boolean).join(', ')}
          <br />
          {order.phone} · {order.email}
        </p>

        <h2>{ro ? 'Întrebări despre comandă' : 'Questions about your order'}</h2>
        <p>
          {shop.seller_name}
          {shop.contact_email && (
            <>
              <br />
              <a href={`mailto:${shop.contact_email}?subject=${encodeURIComponent(`Comanda ${order.number}`)}`}>
                {shop.contact_email}
              </a>
            </>
          )}
          {shop.contact_phone && (
            <>
              <br />
              <a href={`tel:${shop.contact_phone.replace(/[^\d+]/g, '')}`}>{shop.contact_phone}</a>
            </>
          )}
        </p>
        <p>
          <a href={withSiteLanguage('/carti', language)}>{ro ? 'Înapoi la cărți' : 'Back to the books'}</a>
        </p>
      </div>
    </ShopFrame>
  );
}
