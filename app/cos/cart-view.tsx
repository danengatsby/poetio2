'use client';
import type { SiteLanguage } from '@/lib/poem-types';
import { MAX_ITEM_QUANTITY } from '@/lib/shop';
import { cartCount, clearCart, useCart, writeCart } from '@/lib/cart';
import { pick, withSiteLanguage } from '@/lib/site-language';
import ShopFrame, { useShopLanguage } from '../shop-frame';
import { ShopLine, ShopTotals } from '../shop-lines';
import { useInBrowser, useQuote } from '../use-quote';

export default function CartView({ initialLanguage }: { initialLanguage: SiteLanguage }) {
  const [language, changeLanguage] = useShopLanguage(initialLanguage);
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
  if (!inBrowser)
    content = (
      <p>
        {pick(language, 'Se încarcă coșul…', 'Loading your cart…', 'Chargement du panier…', 'Warenkorb wird geladen…')}
      </p>
    );
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
          )}
        </p>
        <a className="shop-button" href={withSiteLanguage('/carti', language)}>
          {pick(language, 'Vezi cărțile', 'Browse the books', 'Voir les livres', 'Bücher ansehen')}
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
          {pick(language, 'Golește coșul', 'Empty the cart', 'Vider le panier', 'Warenkorb leeren')}
        </button>
      </div>
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
        )}
      </p>
    );
  else {
    const { quote, shop } = state;
    content = (
      <div className="shop-layout">
        <section aria-label={pick(language, 'Produse', 'Items', 'Articles', 'Artikel')}>
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
                      {pick(language, 'Cantitate: ', 'Quantity: ', 'Quantité\u00a0: ', 'Menge: ')}
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
                      {pick(language, 'Șterge', 'Delete', 'Supprimer', 'Entfernen')}
                      <span className="sr-only">: {line.title}</span>
                    </button>
                  </div>
                </ShopLine>
              );
            })}
          </ul>
        </section>
        <aside
          className="shop-panel shop-summary"
          aria-label={pick(language, 'Sumar', 'Summary', 'Récapitulatif', 'Übersicht')}
        >
          <ShopTotals quote={quote} language={language} />
          {!shop.ready && (
            <p className="shop-alert">
              {pick(
                language,
                'Comenzile online se deschid în curând.',
                'Online orders open soon.',
                'Les commandes en ligne ouvrent bientôt.',
                'Online-Bestellungen sind bald möglich.',
              )}
            </p>
          )}
          {quote.ok ? (
            <a className="shop-button" href={withSiteLanguage('/comanda', language)}>
              {pick(language, 'Finalizează comanda', 'Proceed to checkout', 'Passer la commande', 'Zur Kasse')}
            </a>
          ) : (
            <button type="button" className="shop-button" disabled>
              {pick(language, 'Finalizează comanda', 'Proceed to checkout', 'Passer la commande', 'Zur Kasse')}
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
      back={{ href: withSiteLanguage('/carti', language), label: pick(language, 'Cărți', 'Books', 'Livres', 'Bücher') }}
    >
      <h1 className="shop-title">
        {pick(language, 'Coșul de cumpărături', 'Shopping cart', 'Panier', 'Warenkorb')}
        {inBrowser && count > 0 && ` (${count})`}
      </h1>
      {content}
    </ShopFrame>
  );
}
