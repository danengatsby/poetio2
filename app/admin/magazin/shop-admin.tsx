'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded covers are served as small derivatives. */
import { useEffect, useState, type FormEvent } from 'react';
import type { ShopBook } from '@/db/shop';
import { BOOK_PRICE_CURRENCIES, formatBookPrice } from '@/lib/book-price';
import { BOOK_LANGUAGES, legalGaps, type PublicShop, type ShopSettings } from '@/lib/shop';
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

/** The amount of a stored price ("45.00 RON" → "45,00") when it is in the shop's currency. */
const amountIn = (price: string | null, currency: string) =>
  price?.endsWith(` ${currency}`) ? price.split(' ')[0].replace('.', ',') : '';
/** Covers of a book that can be ordered: those priced in the shop's currency. */
const onSale = (book: ShopBook, currency: string) =>
  ([1, 2] as const).filter(cover => amountIn(book[cover === 1 ? 'price_1' : 'price_2'], currency));

function BookRow({ book, currency, onSaved }: { book: ShopBook; currency: string; onSaved: (book: ShopBook) => void }) {
  const saved = { 1: amountIn(book.price_1, currency), 2: amountIn(book.price_2, currency) };
  const [amounts, setAmounts] = useState(saved);
  const [stock, setStock] = useState(book.stock === null ? '' : String(book.stock));
  const [language, setLanguage] = useState(book.language);
  const [state, setState] = useState<{ kind: '' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: '' });
  // The second cover is offered only when the book has one (or already has a price for it).
  const covers = book.image_2_id || book.price_2 ? ([1, 2] as const) : ([1] as const);
  const wrongCurrency = ([1, 2] as const).filter(cover => {
    const price = book[cover === 1 ? 'price_1' : 'price_2'];
    return price && !price.endsWith(` ${currency}`);
  });
  const selling = onSale(book, currency);

  async function save(event: FormEvent) {
    event.preventDefault();
    setState({ kind: 'saving' });
    const prices = Object.fromEntries(
      covers.filter(cover => amounts[cover].trim() !== saved[cover]).map(cover => [`price_${cover}`, amounts[cover]]),
    );
    const nextStock = stock.trim() === '' ? null : Number(stock);
    try {
      const response = await fetch(`/api/admin/shop/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: book.revision,
          currency,
          ...(nextStock !== book.stock && { stock: nextStock, expected_stock: book.stock }),
          ...(language !== book.language && { language, expected_language: book.language }),
          ...prices,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nu s-a salvat.');
      const next: ShopBook = result.book;
      setAmounts({ 1: amountIn(next.price_1, currency), 2: amountIn(next.price_2, currency) });
      setStock(next.stock === null ? '' : String(next.stock));
      setLanguage(next.language);
      onSaved(next);
      setState({ kind: 'saved' });
    } catch (failure) {
      setState({ kind: 'error', message: (failure as Error).message });
    }
  }
  const changed = () => setState({ kind: '' });

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
        {selling.length ? (
          <p className="shop-admin-selling">
            Se vinde pe Poetio:{' '}
            {selling
              .map(item => `coperta ${item} – ${formatBookPrice(book[item === 1 ? 'price_1' : 'price_2'], 'ro')}`)
              .join(', ')}
          </p>
        ) : (
          <p className="shop-admin-warning">Nu se vinde încă: scrie prețul mai jos și apasă Salvează.</p>
        )}
        {wrongCurrency.map(item => (
          <p key={item} className="shop-admin-warning">
            Prețul salvat pentru coperta {item} ({formatBookPrice(book[item === 1 ? 'price_1' : 'price_2'], 'ro')}) nu
            este în {currency}, moneda magazinului. Scrie aici prețul în {currency}.
          </p>
        ))}
        <form className="shop-admin-book-form" onSubmit={event => void save(event)}>
          {covers.map(item => (
            <label key={item}>
              {covers.length > 1 ? `Preț coperta ${item}` : 'Preț'} ({currency})
              <input
                disabled={state.kind === 'saving'}
                inputMode="decimal"
                maxLength={10}
                placeholder="ex. 45"
                value={amounts[item]}
                onChange={event => {
                  setAmounts(current => ({ ...current, [item]: event.target.value }));
                  changed();
                }}
              />
            </label>
          ))}
          <label>
            Stoc
            <input
              disabled={state.kind === 'saving'}
              inputMode="numeric"
              pattern="\d*"
              value={stock}
              placeholder="nelimitat"
              onChange={event => {
                setStock(event.target.value);
                changed();
              }}
            />
          </label>
          <label>
            Limba cărții
            <select
              disabled={state.kind === 'saving'}
              value={language}
              onChange={event => {
                setLanguage(event.target.value);
                changed();
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
      setNotice('Setările magazinului au fost salvate.');
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
  const legal = shop ? legalGaps(shop) : [];
  const priced = shop ? books.filter(book => onSale(book, shop.currency).length) : [];
  const available = priced.filter(book => book.stock !== 0).length;
  return (
    <ShopAdminFrame current="/admin/magazin" skip="Mergi la setările magazinului">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Vânzarea cărților pe Poetio</p>
          <h1>Magazin</h1>
          <p>Prețul și stocul fiecărei cărți, apoi vânzătorul, livrarea și plata.</p>
        </div>
      </div>
      {shop && (
        <p className={shop.ready && available ? 'success-message' : 'error-message'} role="status">
          {!shop.ready
            ? `Comenzile sunt închise până completezi mai jos: ${gaps.join(', ')}.`
            : available
              ? `Magazinul este deschis: ${available === 1 ? 'o carte se poate' : `${available} cărți se pot`} comanda.`
              : priced.length
                ? 'Stoc epuizat pentru toate cărțile cu preț. Actualizează stocul pentru a primi comenzi.'
                : `Magazinul este pregătit, dar nicio carte nu are preț în ${shop.currency}, deci nu se poate comanda nimic. Scrie prețul la carte, mai jos, și apasă Salvează.`}
        </p>
      )}
      {shop && legal.length > 0 && (
        <p className="error-message shop-admin-legal">
          Legea cere în termeni și {legal.join(', ')}. Comenzile rămân deschise, dar completează-le mai jos.
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
        </div>
      )}
      {draft && (
        <section className="shop-admin-books" aria-labelledby="stock-title">
          <h2 id="stock-title">Cărțile de vânzare</h2>
          <p className="field-help">
            O carte se poate comanda când are preț în moneda magazinului și este în stoc. Lasă câmpul gol pentru stoc
            nelimitat. Cu stoc 0 cartea apare „Stoc epuizat”. Fiecare comandă scade stocul, anularea îl readuce.
          </p>
          {books.length ? (
            <ul>
              {books.map(book => (
                <BookRow
                  key={`${book.id}:${shop?.currency}`}
                  book={book}
                  currency={shop?.currency ?? draft.currency}
                  onSaved={next => setBooks(list => list.map(item => (item.id === next.id ? next : item)))}
                />
              ))}
            </ul>
          ) : (
            <p>Nu există cărți.</p>
          )}
        </section>
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
              Adresa
              <textarea
                maxLength={300}
                rows={2}
                value={draft.seller_address}
                onChange={event => set('seller_address')(event.target.value)}
              />
              <span className="field-help">
                Stradă, număr, localitate, județ. Legea cere adresa în termeni și în formularul de retragere; poate fi o
                adresă de corespondență. Apare public.
              </span>
            </label>
            <label>
              Date de identificare (opțional)
              <textarea
                maxLength={1000}
                value={draft.seller_details}
                onChange={event => set('seller_details')(event.target.value)}
              />
              <span className="field-help">
                De exemplu CUI și nr. Registrul Comerțului, dacă vinzi printr-o firmă sau un PFA. Apar în termeni.
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
    </ShopAdminFrame>
  );
}
