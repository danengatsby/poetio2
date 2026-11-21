'use client';
import type { PoemLanguage } from '@/lib/poem-types';
import { MAX_ITEM_QUANTITY } from '@/lib/shop';
import { cartCount, clearCart, useCart, writeCart } from '@/lib/cart';
import { withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../shop-frame';
import { ShopLine, ShopTotals } from '../shop-lines';
import { useInBrowser, useQuote } from '../use-quote';

export default function CartView({ initialLanguage }: { initialLanguage: PoemLanguage }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
  const ro = language === 'ro';
  const items = useCart();
  const inBrowser = useInBrowser();
  const state = useQuote(items);
  const count = cartCount(items);

  function setQuantity(index: number, quantity: number) {
    writeCart(items.map((item, position) => (position === index ? { ...item, quantity } : item)));
  }
  function remove(index: number) {
    writeCart(items.filter((_, position) => position !== index));
  }

  let content;
  if (!inBrowser) content = <p>{ro ? 'Se încarcă coșul…' : 'Loading your cart…'}</p>;
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
      <div className="shop-panel shop-empty">
        <p className="shop-alert" role="alert">
          {state.message}
        </p>
        <button type="button" className="shop-link-button" onClick={clearCart}>
          {ro ? 'Golește coșul' : 'Empty the cart'}
        </button>
      </div>
    );
  else if (state.status === 'loading') content = <p>{ro ? 'Se verifică prețurile…' : 'Checking prices…'}</p>;
  else {
    const { quote, shop } = state;
    content = (
      <div className="shop-layout">
        <section aria-label={ro ? 'Produse' : 'Items'}>
          <ul className="shop-lines">
            {quote.lines.map(line => {
              const index = items.findIndex(item => item.book_id === line.book_id && item.cover === line.cover);
              const max = Math.max(
                items[index]?.quantity ?? 1,
                Math.min(MAX_ITEM_QUANTITY, line.stock ?? MAX_ITEM_QUANTITY),
              );
              return (
                <ShopLine key={`${line.book_id}:${line.cover}`} line={line} language={language}>
                  <div className="shop-line-actions">
                    <label>
                      {ro ? 'Cantitate: ' : 'Quantity: '}
                      <select
                        value={items[index]?.quantity ?? line.quantity}
                        onChange={event => setQuantity(index, Number(event.target.value))}
                      >
                        {Array.from({ length: max }, (_, value) => value + 1).map(value => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="shop-link-button" onClick={() => remove(index)}>
                      {ro ? 'Șterge' : 'Delete'}
                      <span className="sr-only">: {line.title}</span>
                    </button>
                  </div>
                </ShopLine>
              );
            })}
          </ul>
        </section>
        <aside className="shop-panel shop-summary" aria-label={ro ? 'Sumar' : 'Summary'}>
          <ShopTotals quote={quote} language={language} />
          {!shop.ready && (
            <p className="shop-alert">{ro ? 'Comenzile online se deschid în curând.' : 'Online orders open soon.'}</p>
          )}
          {quote.ok ? (
            <a className="shop-button" href={withSiteLanguage('/comanda', language)}>
              {ro ? 'Finalizează comanda' : 'Proceed to checkout'}
            </a>
          ) : (
            <button type="button" className="shop-button" disabled>
              {ro ? 'Finalizează comanda' : 'Proceed to checkout'}
            </button>
          )}
        </aside>
      </div>
    );
  }

  return (
    <ShopFrame
      language={language}
      onLanguageChange={changeLanguage}
      cartCurrent
      back={{ href: withSiteLanguage('/carti', language), label: ro ? 'Cărți' : 'Books' }}
    >
      <h1 className="shop-title">
        {ro ? 'Coșul de cumpărături' : 'Shopping cart'}
        {inBrowser && count > 0 && ` (${count})`}
      </h1>
      {content}
    </ShopFrame>
  );
}
