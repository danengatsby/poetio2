'use client';
import type { PoemLanguage } from '@/lib/poem-types';
import { amountCents, formatMoney, paymentLabel, type PublicShop } from '@/lib/shop';
import ShopFrame, { useShopLanguage } from '../shop-frame';
import { VISIT_IP_RETENTION_DAYS } from '@/lib/visits';

export default function TermsView({ initialLanguage, shop }: { initialLanguage: PoemLanguage; shop: PublicShop }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
  const seller = shop.seller_name || 'Poetio';
  const shipping = amountCents(shop.shipping_amount);
  const contact = [shop.contact_email, shop.contact_phone].filter(Boolean).join(' · ');
  const days = `${shop.delivery_min_days}–${shop.delivery_max_days}`;
  const methods = shop.payment_methods.map(method => paymentLabel(method, language)).join(', ');

  return (
    <ShopFrame language={language} onLanguageChange={changeLanguage}>
      <article className="shop-document">
        <h1 className="shop-title">{ro ? 'Termeni și condiții de vânzare' : 'Terms and conditions of sale'}</h1>
        {ro ? (
          <>
            <h2 id="vanzator">Vânzătorul</h2>
            <p>
              Cărțile comandate pe Poetio sunt vândute și expediate de <strong>{seller}</strong>.
              {shop.seller_details && (
                <>
                  <br />
                  <span className="shop-details-text">{shop.seller_details}</span>
                </>
              )}
              {contact && (
                <>
                  <br />
                  Contact: {contact}
                </>
              )}
            </p>
            <h2 id="comanda">Comanda</h2>
            <p>
              Comanda se plasează din coșul de cumpărături sau cu butonul „Cumpără acum”. După trimitere primești
              numărul comenzii și un link unde vezi oricând starea ei. Contractul se încheie când vânzătorul confirmă
              comanda.
            </p>
            <h2 id="preturi">Prețuri și plată</h2>
            <p>
              Prețurile sunt afișate în {shop.currency}, pe pagina fiecărei cărți. Costul livrării este{' '}
              {shipping === null
                ? 'afișat la comandă'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'ro')
                  : 'gratuit'}{' '}
              și se adaugă o singură dată pe comandă. {methods && <>Metode de plată: {methods}.</>}
            </p>
            <h2 id="livrare">Livrarea</h2>
            <p>
              Livrăm prin curier, în România, de obicei în {days} zile lucrătoare de la comandă (de la primirea plății,
              pentru transferul bancar).
            </p>
            <h2 id="retur">Dreptul de retragere și returul</h2>
            <p>
              Poți renunța la cumpărare în 14 zile de la primirea cărților, fără să explici motivul (OUG 34/2014).
              Anunță vânzătorul la datele de contact de mai sus, cu numărul comenzii, apoi trimite cărțile înapoi, în
              starea în care le-ai primit, în cel mult 14 zile. Costul returului este al tău. Îți restituim toate sumele
              plătite, inclusiv livrarea inițială standard, în cel mult 14 zile de la anunțul de retragere; putem amâna
              restituirea până primim cărțile înapoi.
            </p>
            <h2 id="date">Datele personale</h2>
            <p>
              Numele, adresa, telefonul și emailul din comandă sunt folosite doar pentru livrarea cărților, facturare și
              comunicarea despre comandă, și sunt păstrate cât cere legea. Nu sunt vândute și nu sunt folosite pentru
              publicitate. Poți cere oricând să le vezi, să le corectezi sau să fie șterse, scriind vânzătorului.
            </p>
            <p id="vizite">
              Pentru statistica vizitelor și pentru protecția site-ului, la fiecare pagină deschisă păstrăm adresa IP,
              pagina, ora, browserul și localitatea aproximativă deduse din IP. Nu folosim cookie-uri pentru asta și nu
              trimitem aceste date altor firme. Adresa IP și datele browserului se șterg după {VISIT_IP_RETENTION_DAYS}{' '}
              de zile; rămân doar numărul vizitelor, paginile și localitatea.
            </p>
            <h2 id="reclamatii">Reclamații</h2>
            <p>
              Pentru orice problemă scrie-ne mai întâi; răspundem cât mai repede. Te poți adresa și Autorității
              Naționale pentru Protecția Consumatorilor (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ).
            </p>
          </>
        ) : (
          <>
            <h2 id="vanzator">Seller</h2>
            <p>
              Books ordered on Poetio are sold and shipped by <strong>{seller}</strong>.
              {shop.seller_details && (
                <>
                  <br />
                  <span className="shop-details-text">{shop.seller_details}</span>
                </>
              )}
              {contact && (
                <>
                  <br />
                  Contact: {contact}
                </>
              )}
            </p>
            <h2 id="comanda">Orders</h2>
            <p>
              Order from the shopping cart or with “Buy now”. You then get an order number and a link where you can see
              its status at any time. The contract is made when the seller confirms the order.
            </p>
            <h2 id="preturi">Prices and payment</h2>
            <p>
              Prices are shown in {shop.currency} on each book’s page. Delivery costs{' '}
              {shipping === null
                ? 'are shown at checkout'
                : shipping
                  ? formatMoney(shipping, shop.currency, 'en-US')
                  : 'nothing'}{' '}
              and is charged once per order. {methods && <>Payment methods: {methods}.</>}
            </p>
            <h2 id="livrare">Delivery</h2>
            <p>
              We deliver by courier within Romania, usually in {days} working days from the order (from the payment, for
              bank transfers).
            </p>
            <h2 id="retur">Right of withdrawal and returns</h2>
            <p>
              You may cancel the purchase within 14 days of receiving the books without giving a reason. Tell the
              seller, with the order number, then send the books back as you received them within 14 days. You pay for
              the return. We refund everything you paid, including standard delivery, within 14 days of your notice; we
              may wait until the books are back.
            </p>
            <h2 id="date">Personal data</h2>
            <p>
              Your name, address, phone and email are used only to deliver the books, invoice and talk about your order,
              and are kept as long as the law requires. They are never sold or used for advertising. Ask the seller at
              any time to see, correct or delete them.
            </p>
            <p id="vizite">
              To count visits and protect the site, for each page you open we keep your IP address, the page, the time,
              your browser and the approximate town derived from the IP. No cookies are used for this and the data is
              not shared with other companies. The IP address and browser details are deleted after{' '}
              {VISIT_IP_RETENTION_DAYS} days; only visit counts, pages and towns remain.
            </p>
            <h2 id="reclamatii">Complaints</h2>
            <p>
              Please write to us first. You may also contact Romania’s consumer protection authority (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ).
            </p>
          </>
        )}
      </article>
    </ShopFrame>
  );
}
