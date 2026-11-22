'use client';
import type { PoemLanguage } from '@/lib/poem-types';
import { withSiteLanguage } from '@/lib/site-language';
import { addressLine, amountCents, formatMoney, paymentLabel, type PublicShop } from '@/lib/shop';
import ShopFrame, { useShopLanguage } from '../shop-frame';

// Terms of sale required for a distance contract (OUG 34/2014, Legea 365/2002, OUG 140/2021),
// filled in from the seller's settings in /admin/magazin.

function SellerContact({ shop, ro }: { shop: PublicShop; ro: boolean }) {
  return (
    <>
      {shop.seller_address && (
        <>
          <br />
          {ro ? 'Adresa' : 'Address'}: {addressLine(shop.seller_address)}
        </>
      )}
      {shop.seller_details && (
        <>
          <br />
          <span className="shop-details-text">{shop.seller_details}</span>
        </>
      )}
      {shop.contact_email && (
        <>
          <br />
          Email: <a href={`mailto:${shop.contact_email}`}>{shop.contact_email}</a>
        </>
      )}
      {shop.contact_phone && (
        <>
          <br />
          {ro ? 'Telefon' : 'Phone'}:{' '}
          <a href={`tel:${shop.contact_phone.replace(/[^\d+]/g, '')}`}>{shop.contact_phone}</a>
        </>
      )}
    </>
  );
}

/** The model withdrawal form of OUG 34/2014 (annex 1, part B), addressed to this seller. */
function WithdrawalForm({ shop, ro }: { shop: PublicShop; ro: boolean }) {
  const to = [shop.seller_name || 'Poetio', addressLine(shop.seller_address), shop.contact_email]
    .filter(Boolean)
    .join(', ');
  const lines = ro
    ? [
        `Către: ${to}`,
        'Vă informez prin prezenta cu privire la retragerea mea din contractul referitor la vânzarea următoarelor produse: …',
        'Comandate la data: … / primite la data: …',
        'Numărul comenzii: …',
        'Numele consumatorului: …',
        'Adresa consumatorului: …',
        'Semnătura consumatorului (doar dacă formularul este trimis pe hârtie): …',
        'Data: …',
      ]
    : [
        `To: ${to}`,
        'I hereby give notice that I withdraw from my contract of sale of the following goods: …',
        'Ordered on: … / received on: …',
        'Order number: …',
        'Name of consumer: …',
        'Address of consumer: …',
        'Signature of consumer (only if this form is notified on paper): …',
        'Date: …',
      ];
  const subject = ro ? 'Retragere din contract' : 'Withdrawal from contract';
  return (
    <>
      <h2 id="formular-retragere">{ro ? 'Formularul de retragere' : 'Withdrawal form'}</h2>
      <p>
        {ro
          ? 'Completează și trimite acest formular doar dacă vrei să renunți la contract. Poți scrie și cu propriile cuvinte; formularul nu este obligatoriu.'
          : 'Complete and return this form only if you wish to withdraw from the contract. You may also write in your own words; the form is optional.'}
      </p>
      <div className="shop-withdrawal-form">
        {lines.map(line => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {shop.contact_email && (
        <p>
          <a
            href={`mailto:${shop.contact_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n\n'))}`}
          >
            {ro ? 'Trimite formularul prin email' : 'Send the form by email'}
          </a>
        </p>
      )}
    </>
  );
}

export default function TermsView({ initialLanguage, shop }: { initialLanguage: PoemLanguage; shop: PublicShop }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
  const seller = shop.seller_name || 'Poetio';
  const shipping = amountCents(shop.shipping_amount);
  const days = `${shop.delivery_min_days}–${shop.delivery_max_days}`;
  const methods = shop.payment_methods.map(method => paymentLabel(method, language)).join(', ');
  const email = shop.contact_email ? <a href={`mailto:${shop.contact_email}`}>{shop.contact_email}</a> : null;
  const privacy = withSiteLanguage('/confidentialitate', language);
  const sal = (
    <a href="https://anpc.ro/ce-este-sal/" rel="noopener noreferrer">
      anpc.ro/ce-este-sal
    </a>
  );

  return (
    <ShopFrame language={language} onLanguageChange={changeLanguage}>
      <article className="shop-document">
        <h1 className="shop-title">{ro ? 'Termeni și condiții de vânzare' : 'Terms and conditions of sale'}</h1>
        {ro ? (
          <>
            <h2 id="vanzator">Vânzătorul</h2>
            <p>
              Cărțile comandate pe Poetio sunt vândute și expediate de <strong>{seller}</strong>.
              <SellerContact shop={shop} ro />
            </p>
            <h2 id="comanda">Comanda și contractul</h2>
            <p>
              Comanda se plasează din coșul de cumpărături sau cu butonul „Cumpără acum”. Înainte de trimitere vezi
              cărțile, prețul total cu livrarea și metoda de plată. După ce apeși „Comandă cu obligație de plată”
              primești numărul comenzii, un link unde îi vezi oricând starea și un email de confirmare. Contractul se
              încheie când vânzătorul confirmă comanda; dacă o carte nu mai poate fi livrată, te anunțăm și nu plătești
              nimic.
            </p>
            <h2 id="preturi">Prețuri și plată</h2>
            <p>
              Prețurile sunt afișate în {shop.currency}, pe pagina fiecărei cărți, și sunt prețuri finale. Costul
              livrării este{' '}
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
              pentru transferul bancar). Dacă nu putem livra în termenul anunțat, te anunțăm; poți renunța la comandă și
              îți restituim imediat tot ce ai plătit. Răspunderea pentru pierderea sau deteriorarea cărților trece la
              tine când primești coletul.
            </p>
            <h2 id="retur">Dreptul de retragere și returul</h2>
            <p>
              Poți renunța la cumpărare în 14 zile de la ziua în care tu (sau cineva ales de tine, altul decât curierul)
              primești cărțile, fără să explici motivul (OUG 34/2014). Ca să te retragi, anunță vânzătorul înainte să
              treacă cele 14 zile, printr-o declarație clară, de exemplu un email{email && <> la {email}</>}, cu numărul
              comenzii. Poți folosi <a href="#formular-retragere">formularul de retragere</a>, dar nu este obligatoriu.
            </p>
            <p>
              Trimite apoi cărțile înapoi, la adresa vânzătorului, în cel mult 14 zile de la anunț. Costul returului
              este al tău. Răspunzi doar pentru deprecierea cărților cauzată de o folosire mai mult decât necesar pentru
              a le verifica.
            </p>
            <p>
              Îți restituim toate sumele plătite, inclusiv livrarea standard, în cel mult 14 zile de la anunțul de
              retragere, prin aceeași metodă de plată; pentru plata ramburs, prin transfer în contul pe care ni-l
              indici. Putem amâna restituirea până primim cărțile înapoi sau până ne trimiți dovada că le-ai expediat,
              oricare dintre acestea are loc mai întâi.
            </p>
            <WithdrawalForm shop={shop} ro />
            <h2 id="garantie">Garanția legală de conformitate</h2>
            <p>
              Cărțile beneficiază de garanția legală de conformitate (OUG 140/2021) timp de 2 ani de la livrare. Dacă
              primești o carte deteriorată, incompletă sau alta decât cea comandată, scrie-ne: o înlocuim sau, dacă nu
              se poate, îți restituim banii, fără costuri pentru tine.
            </p>
            <h2 id="date">Datele personale</h2>
            <p>
              Numele, adresa, telefonul și emailul din comandă sunt folosite doar pentru livrarea cărților, facturare și
              comunicarea despre comandă. Nu sunt vândute și nu sunt folosite pentru publicitate. Ce date păstrăm, cât
              timp și ce drepturi ai: <a href={privacy}>nota de confidențialitate</a>.
            </p>
            <h2 id="reclamatii">Reclamații și litigii</h2>
            <p>
              Pentru orice problemă scrie-ne mai întâi; răspundem cât mai repede. Te poți adresa și Autorității
              Naționale pentru Protecția Consumatorilor (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) sau poți apela la soluționarea alternativă a litigiilor (SAL): {sal}. Contractul este supus legii
              române.
            </p>
          </>
        ) : (
          <>
            <h2 id="vanzator">Seller</h2>
            <p>
              Books ordered on Poetio are sold and shipped by <strong>{seller}</strong>.
              <SellerContact shop={shop} ro={false} />
            </p>
            <h2 id="comanda">Orders and the contract</h2>
            <p>
              Order from the shopping cart or with “Buy now”. Before sending you see the books, the total price with
              delivery and the payment method. After you press “Order with obligation to pay” you get the order number,
              a link where you can see its status at any time, and a confirmation email. The contract is made when the
              seller confirms the order; if a book can no longer be delivered, we tell you and you pay nothing.
            </p>
            <h2 id="preturi">Prices and payment</h2>
            <p>
              Prices are shown in {shop.currency} on each book’s page and are final prices. Delivery costs{' '}
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
              bank transfers). If we cannot deliver within that time, we tell you; you may cancel the order and we
              refund everything you paid at once. The risk of loss or damage passes to you when you receive the parcel.
            </p>
            <h2 id="retur">Right of withdrawal and returns</h2>
            <p>
              You may withdraw from the purchase within 14 days of the day you (or someone you name, other than the
              carrier) receive the books, without giving a reason. To withdraw, tell the seller before the 14 days have
              passed with a clear statement, for example an email{email && <> to {email}</>}, quoting the order number.
              You may use the <a href="#formular-retragere">withdrawal form</a>, but you do not have to.
            </p>
            <p>
              Then send the books back to the seller’s address within 14 days of your notice. You pay for the return.
              You are only liable for any loss in value caused by handling the books more than needed to examine them.
            </p>
            <p>
              We refund everything you paid, including standard delivery, within 14 days of your notice, using the same
              payment method; for cash on delivery, by transfer to the account you give us. We may wait until we have
              the books back or you have shown that you sent them, whichever is earlier.
            </p>
            <WithdrawalForm shop={shop} ro={false} />
            <h2 id="garantie">Legal guarantee of conformity</h2>
            <p>
              The books carry the legal guarantee of conformity (OUG 140/2021) for 2 years from delivery. If a book
              arrives damaged, incomplete or is not the one you ordered, write to us: we replace it or, if that is not
              possible, refund you, at no cost to you.
            </p>
            <h2 id="date">Personal data</h2>
            <p>
              Your name, address, phone and email are used only to deliver the books, invoice and talk about your order.
              They are never sold or used for advertising. What we keep, for how long and your rights:{' '}
              <a href={privacy}>privacy notice</a>.
            </p>
            <h2 id="reclamatii">Complaints and disputes</h2>
            <p>
              Please write to us first. You may also contact Romania’s consumer protection authority (
              <a href="https://anpc.ro" rel="noopener noreferrer">
                anpc.ro
              </a>
              ) or use alternative dispute resolution (SAL): {sal}. The contract is governed by Romanian law.
            </p>
          </>
        )}
      </article>
    </ShopFrame>
  );
}
