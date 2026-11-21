'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as small derivatives. */
import { useEffect, useState, type FormEvent } from 'react';
import type { ShopBook } from '@/db/shop';
import { BOOK_PRICE_CURRENCIES, formatBookPrice } from '@/lib/book-price';
import { BOOK_LANGUAGES, type PublicShop, type ShopSettings } from '@/lib/shop';
import ShopAdminFrame from '../shop-admin-frame';

type Draft = Omit<ShopSettings, 'delivery_min_days' | 'delivery_max_days'> & {
  delivery_min_days: string;
  delivery_max_days: string;
};
const toDraft = (shop: ShopSettings): Draft => ({
  ...shop,
  shipping_amount: shop.shipping_amount.replace('.', ','),
  delivery_min_days: String(shop.delivery_min_days),
  delivery_max_days: String(shop.delivery_max_days),
});

function missing(shop: PublicShop) {
  const list = [];
  if (!shop.seller_name) list.push('numele vânzătorului');
  if (!shop.contact_email && !shop.contact_phone) list.push('un email sau un telefon de contact');
  if (shop.shipping_amount === '') list.push('costul livrării (0 pentru livrare gratuită)');
  if (!shop.payment_methods.length) list.push('o metodă de plată');
  return list;
}

function BookRow({ book, currency }: { book: ShopBook; currency: string }) {
  const [stock, setStock] = useState(book.stock === null ? '' : String(book.stock));
  const [language, setLanguage] = useState(book.language);
  const [state, setState] = useState<{ kind: '' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: '' });
  const prices = [book.price_1, book.price_2]
    .map((price, index) => ({ cover: index + 1, price }))
    .filter(item => item.price);
  const wrongCurrency = prices.filter(item => !item.price!.endsWith(` ${currency}`));

  async function save(event: FormEvent) {
    event.preventDefault();
    setState({ kind: 'saving' });
    try {
      const response = await fetch(`/api/admin/shop/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: stock.trim() === '' ? null : Number(stock), language }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nu s-a salvat.');
      setState({ kind: 'saved' });
    } catch (failure) {
      setState({ kind: 'error', message: (failure as Error).message });
    }
  }

  const cover = book.image_id || book.image_2_id;
  return (
    <li className="shop-admin-book">
      {cover ? (
        <img src={`/api/images/${cover}?w=320`} width={48} height={64} alt="" />
      ) : (
        <span className="shop-admin-book-cover" />
      )}
      <div>
        <h3>{book.title || 'Fără titlu'}</h3>
        <p>
          {prices.length
            ? prices.map(item => `Coperta ${item.cover}: ${formatBookPrice(item.price, 'ro')}`).join(' · ')
            : 'Fără preț: cartea nu se vinde. Pune un preț în pagina Cărți.'}
        </p>
        {wrongCurrency.length > 0 && (
          <p className="shop-admin-warning">
            Prețul pentru coperta {wrongCurrency.map(item => item.cover).join(' și ')} nu este în {currency}, moneda
            magazinului, deci nu poate fi comandat. Schimbă-l în pagina Cărți.
          </p>
        )}
        <form className="shop-admin-book-form" onSubmit={event => void save(event)}>
          <label>
            Stoc
            <input
              inputMode="numeric"
              pattern="\d*"
              value={stock}
              placeholder="nelimitat"
              onChange={event => {
                setStock(event.target.value);
                setState({ kind: '' });
              }}
            />
          </label>
          <label>
            Limba cărții
            <select
              value={language}
              onChange={event => {
                setLanguage(event.target.value);
                setState({ kind: '' });
              }}
            >
              <option value="">—</option>
              {Object.entries(BOOK_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name.ro}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={state.kind === 'saving'}>
            {state.kind === 'saving' ? 'Se salvează…' : 'Salvează'}
          </button>
          <span role="status" className={state.kind === 'error' ? 'shop-admin-error' : 'shop-admin-saved'}>
            {state.kind === 'saved' ? 'Salvat.' : state.kind === 'error' ? state.message : ''}
          </span>
        </form>
      </div>
    </li>
  );
}

export default function ShopAdmin() {
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [books, setBooks] = useState<ShopBook[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/shop', { cache: 'no-store' })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Setările magazinului nu pot fi încărcate.');
        setShop(result.shop);
        setDraft(toDraft(result.shop));
        setBooks(result.books);
      })
      .catch((failure: Error) => setError(failure.message));
  }, []);

  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) => {
      setDraft(current => (current ? { ...current, [key]: value } : current));
      setNotice('');
    };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          delivery_min_days: Number(draft.delivery_min_days),
          delivery_max_days: Number(draft.delivery_max_days),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Setările nu au fost salvate.');
      setShop(result.shop);
      setDraft(toDraft(result.shop));
      setNotice(result.shop.ready ? 'Salvat. Magazinul primește comenzi.' : 'Salvat.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const text = (key: keyof Draft, label: string, options: { type?: string; help?: string; max?: number } = {}) => (
    <label>
      {label}
      <input
        type={options.type ?? 'text'}
        maxLength={options.max}
        value={String(draft?.[key] ?? '')}
        onChange={event => set(key)(event.target.value as never)}
      />
      {options.help && <span className="field-help">{options.help}</span>}
    </label>
  );

  const gaps = shop ? missing(shop) : [];
  return (
    <ShopAdminFrame current="/admin/magazin" skip="Mergi la setările magazinului">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Vânzarea cărților pe Poetio</p>
          <h1>Magazin</h1>
          <p>Vânzătorul, livrarea, plata și stocul cărților. Prețurile se pun la fiecare carte, în pagina Cărți.</p>
        </div>
      </div>
      {shop && (
        <p className={shop.ready ? 'success-message' : 'error-message'} role="status">
          {shop.ready
            ? 'Magazinul este deschis: vizitatorii pot comanda cărțile care au preț.'
            : `Comenzile sunt închise până completezi: ${gaps.join(', ')}.`}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
        </div>
      )}
      {draft && (
        <form className="editor-fields shop-admin-settings" onSubmit={event => void save(event)}>
          <fieldset>
            <legend>Vânzătorul</legend>
            {text('seller_name', 'Nume (persoană sau firmă)', {
              max: 160,
              help: 'Apare la „Vândut de” și în termeni.',
            })}
            <label>
              Date de identificare (opțional)
              <textarea
                maxLength={1000}
                value={draft.seller_details}
                onChange={event => set('seller_details')(event.target.value)}
              />
              <span className="field-help">
                De exemplu CUI, adresa sediului, nr. Registrul Comerțului. Apar în termeni.
              </span>
            </label>
            {text('contact_email', 'Email de contact', { type: 'email', max: 200 })}
            {text('contact_phone', 'Telefon de contact', { type: 'tel', max: 40 })}
          </fieldset>
          <fieldset>
            <legend>Prețuri și livrare</legend>
            <label>
              Moneda magazinului
              <select value={draft.currency} onChange={event => set('currency')(event.target.value as never)}>
                {BOOK_PRICE_CURRENCIES.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <span className="field-help">Se pot comanda doar cărțile cu prețul în această monedă.</span>
            </label>
            {text('shipping_amount', `Costul livrării pe comandă (${draft.currency})`, {
              max: 12,
              help: 'De exemplu 15,00. Scrie 0 pentru livrare gratuită.',
            })}
            <div className="field-pair">
              {text('delivery_min_days', 'Livrare în minimum (zile lucrătoare)', { type: 'number' })}
              {text('delivery_max_days', 'și maximum (zile lucrătoare)', { type: 'number' })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Plata</legend>
            <label className="shop-admin-check">
              <input
                type="checkbox"
                checked={draft.cod_enabled}
                onChange={event => set('cod_enabled')(event.target.checked)}
              />
              Ramburs (clientul plătește curierului)
            </label>
            <label className="shop-admin-check">
              <input
                type="checkbox"
                checked={draft.transfer_enabled}
                onChange={event => set('transfer_enabled')(event.target.checked)}
              />
              Transfer bancar (expediezi după ce primești banii)
            </label>
            {draft.transfer_enabled && (
              <>
                {text('transfer_beneficiary', 'Beneficiar', { max: 160 })}
                {text('transfer_iban', 'IBAN', { max: 42 })}
                {text('transfer_bank', 'Banca', { max: 120 })}
              </>
            )}
          </fieldset>
          <div className="editor-actions">
            <button className="primary-button" disabled={saving}>
              {saving ? 'Se salvează…' : 'Salvează setările'}
            </button>
            <span role="status" className="success-text">
              {notice}
            </span>
          </div>
        </form>
      )}
      {draft && (
        <section className="shop-admin-books" aria-labelledby="stock-title">
          <h2 id="stock-title">Stocul cărților</h2>
          <p className="field-help">
            Lasă stocul gol dacă nu vrei să-l numeri. Cu stoc 0 cartea apare „Stoc epuizat”. Fiecare comandă scade
            stocul; anularea îl readuce.
          </p>
          {books.length ? (
            <ul>
              {books.map(book => (
                <BookRow key={book.id} book={book} currency={shop?.currency ?? draft.currency} />
              ))}
            </ul>
          ) : (
            <p>Nu există cărți.</p>
          )}
        </section>
      )}
    </ShopAdminFrame>
  );
}
