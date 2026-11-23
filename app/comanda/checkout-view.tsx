'use client';
import { useMemo, useState, type FormEvent } from 'react';
import type { SiteLanguage } from '@/lib/poem-types';
import { clearCart, useCart, type CartItem } from '@/lib/cart';
import { paymentLabel, type PaymentMethod } from '@/lib/shop';
import { pick, withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../shop-frame';
import { ShopLine, ShopTotals } from '../shop-lines';
import { useInBrowser, useQuote } from '../use-quote';

const FIELDS = ['name', 'phone', 'email', 'address', 'city', 'county', 'postal_code', 'note'] as const;
type Field = (typeof FIELDS)[number];

export default function CheckoutView({
  initialLanguage,
  direct,
}: {
  initialLanguage: SiteLanguage;
  direct: CartItem | null;
}) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const cart = useCart();
  const directKey = JSON.stringify(direct);
  const items = useMemo(() => (directKey !== 'null' ? [JSON.parse(directKey) as CartItem] : cart), [directKey, cart]);
  const inBrowser = useInBrowser();
  const state = useQuote(items);
  const [values, setValues] = useState<Record<Field, string>>(
    () => Object.fromEntries(FIELDS.map(field => [field, ''])) as Record<Field, string>,
  );
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const shop = state.status === 'ready' ? state.shop : null;
  const chosen = method || shop?.payment_methods[0] || '';
  const update = (field: Field) => (event: { target: { value: string } }) =>
    setValues(current => ({ ...current, [field]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          payment_method: chosen,
          accept_terms: accepted,
          website: form.get('website') ?? '',
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          response.status === 429 && !data.error
            ? pick(
                language,
                'Prea multe încercări. Așteaptă un minut și trimite din nou.',
                'Too many attempts. Wait a minute and try again.',
                'Trop de tentatives. Attendez une minute et réessayez.',
                'Zu viele Versuche. Warten Sie eine Minute und versuchen Sie es erneut.',
                'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
              )
            : data.error ||
                pick(
                  language,
                  'Comanda nu a putut fi trimisă.',
                  'The order could not be sent.',
                  'La commande n’a pas pu être envoyée.',
                  'Die Bestellung konnte nicht gesendet werden.',
                  'No se pudo enviar el pedido.',
                ),
        );
      if (!direct) clearCart();
      window.location.assign(withSiteLanguage(`/comanda/${data.order.id}?cheie=${data.order.key}`, language));
    } catch (failure) {
      setError((failure as Error).message);
      setSending(false);
    }
  }

  const field = (
    name: Field,
    label: string,
    options: { type?: string; autoComplete?: string; required?: boolean; wide?: boolean; hint?: string; max?: number },
  ) => (
    <label className={`shop-field${options.wide ? ' shop-field-wide' : ''}`}>
      <span>
        {label}
        {options.required === false &&
          ` (${pick(language, 'opțional', 'optional', 'facultatif', 'optional', 'opcional')})`}
      </span>
      <input
        name={name}
        type={options.type ?? 'text'}
        autoComplete={options.autoComplete}
        required={options.required !== false}
        maxLength={options.max}
        value={values[name]}
        onChange={update(name)}
      />
      {options.hint && <small>{options.hint}</small>}
    </label>
  );

  let content;
  if (!inBrowser)
    content = <p>{pick(language, 'Se încarcă…', 'Loading…', 'Chargement…', 'Wird geladen…', 'Cargando…')}</p>;
  else if (!items.length)
    content = (
      <div className="shop-empty shop-panel">
        <p>
          {pick(
            language,
            'Coșul tău este gol.',
            'Your cart is empty.',
            'Votre panier est vide.',
            'Ihr Warenkorb ist leer.',
            'Tu carrito está vacío.',
          )}
        </p>
        <a className="shop-button" href={withSiteLanguage('/carti', language)}>
          {pick(language, 'Vezi cărțile', 'Browse the books', 'Voir les livres', 'Bücher ansehen', 'Ver los libros')}
        </a>
      </div>
    );
  else if (state.status === 'error')
    content = (
      <p className="shop-alert" role="alert">
        {state.message}
      </p>
    );
  else if (state.status === 'loading')
    content = (
      <p>
        {pick(
          language,
          'Se verifică prețurile…',
          'Checking prices…',
          'Vérification des prix…',
          'Preise werden geprüft…',
          'Comprobando precios…',
        )}
      </p>
    );
  else if (!state.shop.ready)
    content = (
      <p className="shop-alert">
        {pick(
          language,
          'Comenzile online se deschid în curând.',
          'Online orders open soon.',
          'Les commandes en ligne ouvrent bientôt.',
          'Online-Bestellungen sind bald möglich.',
          'Los pedidos en línea abrirán pronto.',
        )}
      </p>
    );
  else {
    const { quote } = state;
    content = (
      <form className="shop-layout" onSubmit={event => void submit(event)}>
        <div className="shop-form">
          <fieldset>
            <legend>
              {pick(
                language,
                '1. Adresa de livrare',
                '1. Delivery address',
                '1. Adresse de livraison',
                '1. Lieferadresse',
                '1. Dirección de entrega',
              )}
            </legend>
            {field(
              'name',
              pick(
                language,
                'Nume și prenume',
                'Full name',
                'Nom et prénom',
                'Vor- und Nachname',
                'Nombre y apellidos',
              ),
              {
                autoComplete: 'name',
                wide: true,
                max: 120,
              },
            )}
            {field('phone', pick(language, 'Telefon', 'Phone', 'Téléphone', 'Telefon', 'Teléfono'), {
              type: 'tel',
              autoComplete: 'tel',
              max: 30,
              hint: pick(
                language,
                'Pentru curier.',
                'For the courier.',
                'Pour le livreur.',
                'Für den Kurier.',
                'Para el mensajero.',
              ),
            })}
            {field('email', 'Email', {
              type: 'email',
              autoComplete: 'email',
              max: 200,
              hint: pick(
                language,
                'Pentru confirmarea comenzii.',
                'For the order confirmation.',
                'Pour la confirmation de commande.',
                'Für die Bestellbestätigung.',
                'Para la confirmación del pedido.',
              ),
            })}
            {field(
              'address',
              pick(
                language,
                'Adresa (stradă, număr, bloc, scară, apartament)',
                'Street address',
                'Adresse',
                'Straße und Hausnummer',
                'Dirección',
              ),
              {
                autoComplete: 'street-address',
                wide: true,
                max: 300,
              },
            )}
            {field('city', pick(language, 'Localitatea', 'City', 'Localité', 'Ort', 'Localidad'), {
              autoComplete: 'address-level2',
              max: 100,
            })}
            {field(
              'county',
              pick(
                language,
                'Județul / sectorul',
                'County',
                'Département (județ)',
                'Kreis (județ)',
                'Distrito (județ)',
              ),
              {
                autoComplete: 'address-level1',
                max: 100,
              },
            )}
            {field(
              'postal_code',
              pick(language, 'Cod poștal', 'Postal code', 'Code postal', 'Postleitzahl', 'Código postal'),
              {
                autoComplete: 'postal-code',
                required: false,
                max: 12,
              },
            )}
            <label className="shop-field shop-field-wide">
              <span>
                {pick(
                  language,
                  'Observații pentru vânzător',
                  'Note for the seller',
                  'Note pour le vendeur',
                  'Hinweis für den Verkäufer',
                  'Nota para el vendedor',
                )}{' '}
                ({pick(language, 'opțional', 'optional', 'facultatif', 'optional', 'opcional')})
              </span>
              <textarea name="note" maxLength={1000} value={values.note} onChange={update('note')} />
            </label>
            <label className="shop-trap" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </fieldset>
          <fieldset>
            <legend>
              {pick(
                language,
                '2. Metoda de plată',
                '2. Payment method',
                '2. Mode de paiement',
                '2. Zahlungsart',
                '2. Forma de pago',
              )}
            </legend>
            {state.shop.payment_methods.map(item => (
              <label key={item} className="shop-choice">
                <input
                  type="radio"
                  name="payment_method"
                  value={item}
                  checked={chosen === item}
                  onChange={() => setMethod(item)}
                />
                <span>
                  {paymentLabel(item, language)}
                  <small>
                    {item === 'cod'
                      ? pick(
                          language,
                          'Plătești curierului când primești coletul.',
                          'Pay the courier when the parcel arrives.',
                          'Vous payez le livreur à la réception du colis.',
                          'Sie zahlen bei Lieferung an den Kurier.',
                          'Pagas al mensajero cuando llega el paquete.',
                        )
                      : pick(
                          language,
                          'Primești datele contului după plasarea comenzii; expediem după ce plata ajunge.',
                          'You get the account details after ordering; we ship once the payment arrives.',
                          'Vous recevez les coordonnées bancaires après la commande\u00a0; nous expédions dès réception du paiement.',
                          'Die Kontodaten erhalten Sie nach der Bestellung; wir versenden nach Zahlungseingang.',
                          'Recibes los datos de la cuenta tras el pedido; enviamos en cuanto llega el pago.',
                        )}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>
              {pick(
                language,
                '3. Verifică produsele',
                '3. Review items',
                '3. Vérifiez les articles',
                '3. Artikel prüfen',
                '3. Revisa los artículos',
              )}
            </legend>
            <ul className="shop-lines shop-field-wide">
              {quote.lines.map(line => (
                <ShopLine key={`${line.book_id}:${line.cover}`} line={line} language={language} heading="h3" />
              ))}
            </ul>
            {!direct && (
              <a className="shop-field-wide" href={withSiteLanguage('/cos', language)}>
                {pick(
                  language,
                  'Modifică coșul',
                  'Change the cart',
                  'Modifier le panier',
                  'Warenkorb ändern',
                  'Cambiar el carrito',
                )}
              </a>
            )}
          </fieldset>
        </div>
        <aside
          className="shop-panel shop-summary"
          aria-label={pick(
            language,
            'Sumarul comenzii',
            'Order summary',
            'Récapitulatif de la commande',
            'Bestellübersicht',
            'Resumen del pedido',
          )}
        >
          <ShopTotals quote={quote} language={language} />
          <label className="shop-choice">
            <input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} />
            <span>
              {pick(
                language,
                'Am citit și accept ',
                'I have read and accept the ',
                'J’ai lu et j’accepte les ',
                'Ich habe die ',
                'He leído y acepto los ',
              )}
              <a href={withSiteLanguage('/termeni', language)} target="_blank" rel="noopener">
                {pick(
                  language,
                  'termenii și condițiile',
                  'terms and conditions',
                  'conditions générales de vente',
                  'Allgemeinen Geschäftsbedingungen',
                  'términos y condiciones',
                )}
              </a>
              {pick(
                language,
                ', inclusiv dreptul de retragere în 14 zile.',
                ', including the 14-day right of withdrawal.',
                ', y compris le droit de rétractation de 14\u00a0jours.',
                ' gelesen und akzeptiere sie, einschließlich des 14-tägigen Widerrufsrechts.',
                ', incluido el derecho de desistimiento de 14 días.',
              )}
            </span>
          </label>
          {error && (
            <p className="shop-alert" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="shop-button shop-button-orange" disabled={sending || !quote.ok}>
            {sending
              ? pick(language, 'Se trimite…', 'Sending…', 'Envoi…', 'Wird gesendet…', 'Enviando…')
              : pick(
                  language,
                  'Comandă cu obligație de plată',
                  'Order with obligation to pay',
                  'Commande avec obligation de paiement',
                  'Zahlungspflichtig bestellen',
                  'Pedido con obligación de pago',
                )}
          </button>
          <p className="shop-note">
            {pick(
              language,
              'Comanda te obligă la plată. Datele tale sunt folosite doar pentru livrarea cărților (',
              'Placing the order means you agree to pay. Your details are used only to deliver the books (',
              'Passer la commande vous engage à payer. Vos données servent uniquement à livrer les livres (',
              'Mit der Bestellung verpflichten Sie sich zur Zahlung. Ihre Daten werden nur für die Lieferung der Bücher verwendet (',
              'Al hacer el pedido te comprometes a pagar. Tus datos solo se usan para entregar los libros (',
            )}
            <a href={withSiteLanguage('/confidentialitate', language)} target="_blank" rel="noopener">
              {pick(language, 'confidențialitate', 'privacy', 'confidentialité', 'Datenschutz', 'privacidad')}
            </a>
            ).
          </p>
        </aside>
      </form>
    );
  }

  return (
    <ShopFrame
      language={language}
      onLanguageChange={changeLanguage}
      back={
        direct
          ? undefined
          : {
              href: withSiteLanguage('/cos', language),
              label: pick(
                language,
                'Înapoi la coș',
                'Back to the cart',
                'Retour au panier',
                'Zurück zum Warenkorb',
                'Volver al carrito',
              ),
            }
      }
    >
      <h1 className="shop-title">
        {pick(language, 'Finalizează comanda', 'Checkout', 'Commande', 'Kasse', 'Finalizar pedido')}
      </h1>
      {content}
    </ShopFrame>
  );
}
