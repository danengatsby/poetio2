'use client';
import { useMemo, useState, type FormEvent } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import { clearCart, useCart, type CartItem } from '@/lib/cart';
import { paymentLabel, type PaymentMethod } from '@/lib/shop';
import { withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../shop-frame';
import { ShopLine, ShopTotals } from '../shop-lines';
import { useInBrowser, useQuote } from '../use-quote';

const FIELDS = ['name', 'phone', 'email', 'address', 'city', 'county', 'postal_code', 'note'] as const;
type Field = (typeof FIELDS)[number];

export default function CheckoutView({
  initialLanguage,
  direct,
}: {
  initialLanguage: PoemLanguage;
  direct: CartItem | null;
}) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
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
            ? ro
              ? 'Prea multe încercări. Așteaptă un minut și trimite din nou.'
              : 'Too many attempts. Wait a minute and try again.'
            : data.error || (ro ? 'Comanda nu a putut fi trimisă.' : 'The order could not be sent.'),
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
        {options.required === false && ` (${ro ? 'opțional' : 'optional'})`}
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
  if (!inBrowser) content = <p>{ro ? 'Se încarcă…' : 'Loading…'}</p>;
  else if (!items.length)
    content = (
      <div className="shop-empty shop-panel">
        <p>{ro ? 'Coșul tău este gol.' : 'Your cart is empty.'}</p>
        <a className="shop-button" href={withSiteLanguage('/carti', language)}>
          {ro ? 'Vezi cărțile' : 'Browse the books'}
        </a>
      </div>
    );
  else if (state.status === 'error')
    content = (
      <p className="shop-alert" role="alert">
        {state.message}
      </p>
    );
  else if (state.status === 'loading') content = <p>{ro ? 'Se verifică prețurile…' : 'Checking prices…'}</p>;
  else if (!state.shop.ready)
    content = (
      <p className="shop-alert">{ro ? 'Comenzile online se deschid în curând.' : 'Online orders open soon.'}</p>
    );
  else {
    const { quote } = state;
    content = (
      <form className="shop-layout" onSubmit={event => void submit(event)}>
        <div className="shop-form">
          <fieldset>
            <legend>{ro ? '1. Adresa de livrare' : '1. Delivery address'}</legend>
            {field('name', ro ? 'Nume și prenume' : 'Full name', { autoComplete: 'name', wide: true, max: 120 })}
            {field('phone', ro ? 'Telefon' : 'Phone', {
              type: 'tel',
              autoComplete: 'tel',
              max: 30,
              hint: ro ? 'Pentru curier.' : 'For the courier.',
            })}
            {field('email', 'Email', {
              type: 'email',
              autoComplete: 'email',
              max: 200,
              hint: ro ? 'Pentru confirmarea comenzii.' : 'For the order confirmation.',
            })}
            {field('address', ro ? 'Adresa (stradă, număr, bloc, scară, apartament)' : 'Street address', {
              autoComplete: 'street-address',
              wide: true,
              max: 300,
            })}
            {field('city', ro ? 'Localitatea' : 'City', { autoComplete: 'address-level2', max: 100 })}
            {field('county', ro ? 'Județul / sectorul' : 'County', { autoComplete: 'address-level1', max: 100 })}
            {field('postal_code', ro ? 'Cod poștal' : 'Postal code', {
              autoComplete: 'postal-code',
              required: false,
              max: 12,
            })}
            <label className="shop-field shop-field-wide">
              <span>
                {ro ? 'Observații pentru vânzător' : 'Note for the seller'} ({ro ? 'opțional' : 'optional'})
              </span>
              <textarea name="note" maxLength={1000} value={values.note} onChange={update('note')} />
            </label>
            <label className="shop-trap" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </fieldset>
          <fieldset>
            <legend>{ro ? '2. Metoda de plată' : '2. Payment method'}</legend>
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
                      ? ro
                        ? 'Plătești curierului când primești coletul.'
                        : 'Pay the courier when the parcel arrives.'
                      : ro
                        ? 'Primești datele contului după plasarea comenzii; expediem după ce plata ajunge.'
                        : 'You get the account details after ordering; we ship once the payment arrives.'}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{ro ? '3. Verifică produsele' : '3. Review items'}</legend>
            <ul className="shop-lines shop-field-wide">
              {quote.lines.map(line => (
                <ShopLine key={`${line.book_id}:${line.cover}`} line={line} language={language} heading="h3" />
              ))}
            </ul>
            {!direct && (
              <a className="shop-field-wide" href={withSiteLanguage('/cos', language)}>
                {ro ? 'Modifică coșul' : 'Change the cart'}
              </a>
            )}
          </fieldset>
        </div>
        <aside className="shop-panel shop-summary" aria-label={ro ? 'Sumarul comenzii' : 'Order summary'}>
          <ShopTotals quote={quote} language={language} />
          <label className="shop-choice">
            <input type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)} />
            <span>
              {ro ? 'Am citit și accept ' : 'I have read and accept the '}
              <a href={withSiteLanguage('/termeni', language)} target="_blank" rel="noopener">
                {ro ? 'termenii și condițiile' : 'terms and conditions'}
              </a>
              {ro ? ', inclusiv dreptul de retragere în 14 zile.' : ', including the 14-day right of withdrawal.'}
            </span>
          </label>
          {error && (
            <p className="shop-alert" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="shop-button shop-button-orange" disabled={sending || !quote.ok}>
            {sending
              ? ro
                ? 'Se trimite…'
                : 'Sending…'
              : ro
                ? 'Comandă cu obligație de plată'
                : 'Order with obligation to pay'}
          </button>
          <p className="shop-note">
            {ro
              ? 'Comanda te obligă la plată. Datele tale sunt folosite doar pentru livrarea cărților ('
              : 'Placing the order means you agree to pay. Your details are used only to deliver the books ('}
            <a href={withSiteLanguage('/confidentialitate', language)} target="_blank" rel="noopener">
              {ro ? 'confidențialitate' : 'privacy'}
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
          : { href: withSiteLanguage('/cos', language), label: ro ? 'Înapoi la coș' : 'Back to the cart' }
      }
    >
      <h1 className="shop-title">{ro ? 'Finalizează comanda' : 'Checkout'}</h1>
      {content}
    </ShopFrame>
  );
}
