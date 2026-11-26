'use client';
import type { Order } from '@/db/shop';
import type { SiteLanguage } from '@/lib/poem-types';
import { formatMoney, paymentLabel, statusLabel, type OrderStatus, type PublicShop } from '@/lib/shop';
import { pick, withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../../shop-frame';
import { ShopLine, ShopTotals } from '../../shop-lines';

const englishStatus: Record<OrderStatus, string> = {
  new: 'Received',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const frenchStatus: Record<OrderStatus, string> = {
  new: 'Reçue',
  confirmed: 'Confirmée',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};
const germanStatus: Record<OrderStatus, string> = {
  new: 'Eingegangen',
  confirmed: 'Bestätigt',
  shipped: 'Versandt',
  delivered: 'Zugestellt',
  cancelled: 'Storniert',
};
const spanishStatus: Record<OrderStatus, string> = {
  new: 'Recibido',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
const italianStatus: Record<OrderStatus, string> = {
  new: 'Ricevuto',
  confirmed: 'Confermato',
  shipped: 'Spedito',
  delivered: 'Consegnato',
  cancelled: 'Annullato',
};

export default function OrderView({
  initialLanguage,
  order,
  shop,
  delivery,
}: {
  initialLanguage: SiteLanguage;
  order: Order;
  shop: PublicShop;
  delivery: Record<SiteLanguage, string>;
}) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const money = (cents: number) => formatMoney(cents, order.currency, language);
  const open = order.status === 'new' || order.status === 'confirmed';
  const placed = new Intl.DateTimeFormat(pick(language, 'ro-RO', 'en-US', 'fr-FR', 'de-DE', 'es-ES', 'it-IT'), {
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
            {pick(
              language,
              `Comanda nr. ${order.number} a fost anulată.`,
              `Order no. ${order.number} was cancelled.`,
              `La commande n°\u00a0${order.number} a été annulée.`,
              `Bestellung Nr. ${order.number} wurde storniert.`,
              `El pedido n.º ${order.number} se ha cancelado.`,
              `L’ordine n. ${order.number} è stato annullato.`,
            )}
          </p>
        ) : (
          <p className="shop-alert shop-ok" role="status">
            {pick(
              language,
              `Mulțumim! Comanda nr. ${order.number} a fost înregistrată.`,
              `Thank you! Order no. ${order.number} has been placed.`,
              `Merci\u00a0! La commande n°\u00a0${order.number} a bien été passée.`,
              `Vielen Dank! Bestellung Nr. ${order.number} ist eingegangen.`,
              `¡Gracias! Se ha realizado el pedido n.º ${order.number}.`,
              `Grazie! L’ordine n. ${order.number} è stato effettuato.`,
            )}
          </p>
        )}
        <h1 className="shop-title">
          {pick(
            language,
            `Comanda nr. ${order.number}`,
            `Order no. ${order.number}`,
            `Commande n°\u00a0${order.number}`,
            `Bestellung Nr. ${order.number}`,
            `Pedido n.º ${order.number}`,
            `Ordine n. ${order.number}`,
          )}
        </h1>
        <dl className="shop-details">
          <dt>{pick(language, 'Plasată', 'Placed', 'Passée le', 'Aufgegeben am', 'Realizado', 'Effettuato il')}</dt>
          <dd>{placed}</dd>
          <dt>{pick(language, 'Stare', 'Status', 'Statut', 'Status', 'Estado', 'Stato')}</dt>
          <dd>
            <strong>
              {
                pick(language, statusLabel, englishStatus, frenchStatus, germanStatus, spanishStatus, italianStatus)[
                  order.status
                ]
              }
            </strong>
          </dd>
          {open && (
            <>
              <dt>
                {pick(
                  language,
                  'Livrare estimată',
                  'Estimated delivery',
                  'Livraison estimée',
                  'Voraussichtliche Lieferung',
                  'Entrega estimada',
                  'Consegna prevista',
                )}
              </dt>
              <dd>
                {delivery[language]}{' '}
                {order.delivery_min_days == null &&
                  pick(
                    language,
                    '(estimare recalculată)',
                    '(recalculated estimate)',
                    '(estimation recalculée)',
                    '(neu geschätzt)',
                    '(estimación recalculada)',
                    '(stima ricalcolata)',
                  )}
                {order.payment_method === 'transfer' &&
                  pick(
                    language,
                    ' (după primirea plății)',
                    ' (after the payment arrives)',
                    ' (après réception du paiement)',
                    ' (nach Zahlungseingang)',
                    ' (tras recibir el pago)',
                    ' (dopo il ricevimento del pagamento)',
                  )}
              </dd>
            </>
          )}
          <dt>{pick(language, 'Plată', 'Payment', 'Paiement', 'Zahlung', 'Pago', 'Pagamento')}</dt>
          <dd>{paymentLabel(order.payment_method, language)}</dd>
        </dl>
        <p className="shop-note">
          {pick(
            language,
            'Păstrează linkul acestei pagini: îl poți deschide oricând pentru a vedea starea comenzii.',
            'Keep the link to this page: you can open it any time to see the status of your order.',
            'Conservez le lien de cette page\u00a0: vous pouvez l’ouvrir à tout moment pour suivre votre commande.',
            'Bewahren Sie den Link zu dieser Seite auf: Sie können ihn jederzeit öffnen, um den Status Ihrer Bestellung zu sehen.',
            'Guarda el enlace de esta página: puedes abrirlo cuando quieras para ver el estado de tu pedido.',
            'Conserva il link a questa pagina: puoi aprirlo in qualsiasi momento per vedere lo stato del tuo ordine.',
          )}
        </p>

        {open && order.payment_method === 'transfer' && (
          <section className="shop-panel" aria-labelledby="payment-title">
            <h2 id="payment-title">
              {pick(
                language,
                'Plata prin transfer bancar',
                'Bank transfer',
                'Virement bancaire',
                'Banküberweisung',
                'Transferencia bancaria',
                'Bonifico bancario',
              )}
            </h2>
            <dl className="shop-details">
              <dt>
                {pick(
                  language,
                  'Beneficiar',
                  'Beneficiary',
                  'Bénéficiaire',
                  'Empfänger',
                  'Beneficiario',
                  'Beneficiario',
                )}
              </dt>
              <dd>{shop.transfer_beneficiary || shop.seller_name}</dd>
              <dt>IBAN</dt>
              <dd className="shop-iban">{shop.transfer_iban.replace(/(.{4})/g, '$1 ').trim()}</dd>
              {shop.transfer_bank && (
                <>
                  <dt>{pick(language, 'Banca', 'Bank', 'Banque', 'Bank', 'Banco', 'Banca')}</dt>
                  <dd>{shop.transfer_bank}</dd>
                </>
              )}
              <dt>{pick(language, 'Suma', 'Amount', 'Montant', 'Betrag', 'Importe', 'Importo')}</dt>
              <dd>
                <strong>{money(order.total_cents)}</strong>
              </dd>
              <dt>
                {pick(language, 'Detalii plată', 'Reference', 'Référence', 'Verwendungszweck', 'Concepto', 'Causale')}
              </dt>
              <dd>
                {pick(
                  language,
                  `Comanda ${order.number}`,
                  `Order ${order.number}`,
                  `Commande ${order.number}`,
                  `Bestellung ${order.number}`,
                  `Pedido ${order.number}`,
                  `Ordine ${order.number}`,
                )}
              </dd>
            </dl>
            <p className="shop-note">
              {pick(
                language,
                'Expediem cărțile după ce plata ajunge în cont.',
                'We ship the books once the payment reaches the account.',
                'Nous expédions les livres dès que le paiement est crédité sur le compte.',
                'Wir versenden die Bücher, sobald die Zahlung auf dem Konto eingegangen ist.',
                'Enviamos los libros en cuanto el pago llega a la cuenta.',
                'Spediamo i libri non appena il pagamento arriva sul conto.',
              )}
            </p>
          </section>
        )}
        {open && order.payment_method === 'cod' && (
          <p>
            {pick(
              language,
              `Plătești ${money(order.total_cents)} curierului, când primești coletul.`,
              `You pay ${money(order.total_cents)} to the courier when the parcel arrives.`,
              `Vous payez ${money(order.total_cents)} au livreur à la réception du colis.`,
              `Sie zahlen ${money(order.total_cents)} bei Lieferung an den Kurier.`,
              `Pagas ${money(order.total_cents)} al mensajero cuando llega el paquete.`,
              `Paghi ${money(order.total_cents)} al corriere quando arriva il pacco.`,
            )}
          </p>
        )}

        <h2>{pick(language, 'Produse', 'Items', 'Articles', 'Artikel', 'Artículos', 'Articoli')}</h2>
        <ul className="shop-lines">
          {lines.map(line => (
            <ShopLine key={`${line.book_id}:${line.cover}`} line={line} language={language} heading="h3" />
          ))}
        </ul>
        <div className="shop-summary shop-panel">
          <ShopTotals quote={{ ...order, lines }} language={language} />
        </div>

        <h2>
          {pick(language, 'Livrare la', 'Delivery to', 'Livraison à', 'Lieferung an', 'Entrega en', 'Consegna a')}
        </h2>
        <p>
          {order.customer_name}
          <br />
          {order.address}
          <br />
          {[order.city, order.county, order.postal_code].filter(Boolean).join(', ')}
          <br />
          {order.phone} · {order.email}
        </p>

        <h2>
          {pick(
            language,
            'Întrebări despre comandă',
            'Questions about your order',
            'Questions sur votre commande',
            'Fragen zu Ihrer Bestellung',
            'Preguntas sobre tu pedido',
            'Domande sul tuo ordine',
          )}
        </h2>
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
          <a href={withSiteLanguage('/carti', language)}>
            {pick(
              language,
              'Înapoi la cărți',
              'Back to the books',
              'Retour aux livres',
              'Zurück zu den Büchern',
              'Volver a los libros',
              'Torna ai libri',
            )}
          </a>
        </p>
      </div>
    </ShopFrame>
  );
}
