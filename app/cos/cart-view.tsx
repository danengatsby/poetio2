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
        {pick(
          language,
          'Se încarcă coșul…',
          'Loading your cart…',
          'Chargement du panier…',
          'Warenkorb wird geladen…',
          'Cargando tu carrito…',
          'Caricamento del carrello…',
        )}
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
            'Tu carrito está vacío.',
            'Il tuo carrello è vuoto.',
          )}
        </p>
        <a className="shop-button" href={withSiteLanguage('/carti', language)}>
          {pick(
            language,
            'Vezi cărțile',
            'Browse the books',
            'Voir les livres',
            'Bücher ansehen',
            'Ver los libros',
            'Sfoglia i libri',
          )}
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
          {pick(
            language,
            'Golește coșul',
            'Empty the cart',
            'Vider le panier',
            'Warenkorb leeren',
            'Vaciar el carrito',
            'Svuota il carrello',
          )}
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
          'Comprobando precios…',
          'Verifica dei prezzi…',
        )}
      </p>
    );
  else {
    const { quote, shop } = state;
    content = (
      <div className="shop-layout">
        <section aria-label={pick(language, 'Produse', 'Items', 'Articles', 'Artikel', 'Artículos', 'Articoli')}>
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
                      {pick(
                        language,
                        'Cantitate: ',
                        'Quantity: ',
                        'Quantité\u00a0: ',
                        'Menge: ',
                        'Cantidad: ',
                        'Quantità: ',
                      )}
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
                      {pick(language, 'Șterge', 'Delete', 'Supprimer', 'Entfernen', 'Eliminar', 'Elimina')}
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
          aria-label={pick(language, 'Sumar', 'Summary', 'Récapitulatif', 'Übersicht', 'Resumen', 'Riepilogo')}
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
                'Los pedidos en línea abrirán pronto.',
                'Gli ordini online apriranno presto.',
              )}
            </p>
          )}
          {quote.ok ? (
            <a className="shop-button" href={withSiteLanguage('/comanda', language)}>
              {pick(
                language,
                'Finalizează comanda',
                'Proceed to checkout',
                'Passer la commande',
                'Zur Kasse',
                'Tramitar pedido',
                'Procedi all’acquisto',
              )}
            </a>
          ) : (
            <button type="button" className="shop-button" disabled>
              {pick(
                language,
                'Finalizează comanda',
                'Proceed to checkout',
                'Passer la commande',
                'Zur Kasse',
                'Tramitar pedido',
                'Procedi all’acquisto',
              )}
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
      back={{
        href: withSiteLanguage('/carti', language),
        label: pick(language, 'Cărți', 'Books', 'Livres', 'Bücher', 'Libros', 'Libri'),
      }}
    >
      <h1 className="shop-title">
        {pick(language, 'Coșul de cumpărături', 'Shopping cart', 'Panier', 'Warenkorb', 'Carrito', 'Carrello')}
        {inBrowser && count > 0 && ` (${count})`}
      </h1>
      {content}
    </ShopFrame>
  );
}
