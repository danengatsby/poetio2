'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Order } from '@/db/shop';
import { NEXT_STATUSES, ORDER_STATUSES, formatMoney, paymentLabel, statusLabel, type OrderStatus } from '@/lib/shop';
import ShopAdminFrame from '../shop-admin-frame';

type Page = { orders: Order[]; counts: Record<OrderStatus, number>; hasMore: boolean };
const actionLabel: Record<OrderStatus, string> = {
  new: 'Nouă',
  confirmed: 'Confirmă comanda',
  shipped: 'Marchează expediată',
  delivered: 'Marchează livrată',
  cancelled: 'Anulează',
};
const filterLabel: Record<OrderStatus, string> = {
  new: 'Noi',
  confirmed: 'Confirmate',
  shipped: 'Expediate',
  delivered: 'Livrate',
  cancelled: 'Anulate',
};
const when = (value: number) =>
  new Intl.DateTimeFormat('ro', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' }).format(
    value,
  );

export default function OrdersAdmin() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('new');
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const inFlight = useRef(false);
  const locked = loading || busy;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/orders?status=${status}&offset=${offset}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Comenzile nu pot fi încărcate. Încearcă din nou.');
        setData(result);
      })
      .catch((failure: Error) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, offset, reload]);

  function refresh(nextOffset = offset) {
    setLoading(true);
    setError('');
    setOffset(nextOffset);
    setReload(value => value + 1);
  }

  async function move(order: Order, next: OrderStatus) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: order.status, status: next }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Starea comenzii nu a fost schimbată. Reîncarcă lista.');
      setNotice(
        next === 'cancelled'
          ? `Comanda nr. ${order.number} a fost anulată; exemplarele au revenit în stoc.`
          : `Comanda nr. ${order.number}: ${statusLabel[next].toLowerCase()}.`,
      );
      refresh(status !== 'all' && data?.orders.length === 1 && offset > 0 ? offset - 20 : offset);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setCancelling(null);
      setBusy(false);
      inFlight.current = false;
    }
  }

  const total = data ? Object.values(data.counts).reduce((sum, value) => sum + value, 0) : null;
  return (
    <ShopAdminFrame current="/admin/comenzi" skip="Mergi la comenzi">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Magazinul Poetio</p>
          <h1>Comenzi</h1>
          <p>Confirmă comenzile noi, apoi marchează-le expediate și livrate. Anularea readuce exemplarele în stoc.</p>
        </div>
        <button className="secondary-button" disabled={locked} onClick={() => refresh()}>
          Reîncarcă lista
        </button>
      </div>
      <div className="shop-admin-feedback">
        <p role="status" className={notice ? 'success-message' : undefined}>
          {notice}
        </p>
        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
          </div>
        )}
      </div>
      <div className="shop-admin-filters" role="group" aria-label="Starea comenzilor">
        {([...ORDER_STATUSES, 'all'] as const).map(value => (
          <button
            key={value}
            className="secondary-button"
            disabled={locked}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setNotice('');
              refresh(0);
            }}
          >
            {value === 'all' ? 'Toate' : filterLabel[value]}
            {data && <span> ({value === 'all' ? total : data.counts[value]})</span>}
          </button>
        ))}
      </div>
      {loading && <p role="status">Se încarcă comenzile…</p>}
      <section aria-label="Lista comenzilor" aria-busy={loading}>
        {!loading && data && !data.orders.length && (
          <p className="shop-admin-empty">Nu sunt comenzi în această categorie.</p>
        )}
        {data && data.orders.length > 0 && (
          <ul className="shop-admin-orders">
            {data.orders.map(order => {
              const money = (cents: number) => formatMoney(cents, order.currency, 'ro');
              return (
                <li key={order.id}>
                  <article className="shop-admin-card" aria-label={`Comanda nr. ${order.number}`}>
                    <div className="shop-admin-card-top">
                      <h2>Comanda nr. {order.number}</h2>
                      <span className={`shop-admin-badge shop-admin-${order.status}`}>{statusLabel[order.status]}</span>
                    </div>
                    <p className="shop-admin-meta">
                      <time dateTime={new Date(order.created_at).toISOString()}>{when(order.created_at)}</time> ·{' '}
                      {paymentLabel(order.payment_method, 'ro')} · <strong>{money(order.total_cents)}</strong>
                    </p>
                    <div className="shop-admin-columns">
                      <div>
                        <h3>Client</h3>
                        <p dir="auto">
                          {order.customer_name}
                          <br />
                          <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`}>{order.phone}</a>
                          <br />
                          <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Comanda ${order.number}`)}`}>
                            {order.email}
                          </a>
                        </p>
                        <h3>Livrare la</h3>
                        <p dir="auto">
                          {order.address}
                          <br />
                          {[order.city, order.county, order.postal_code].filter(Boolean).join(', ')}
                        </p>
                        {order.note && (
                          <>
                            <h3>Observații</h3>
                            <p className="shop-admin-note" dir="auto">
                              {order.note}
                            </p>
                          </>
                        )}
                      </div>
                      <div>
                        <h3>Produse</h3>
                        <ul className="shop-admin-items">
                          {order.items.map(item => (
                            <li key={`${item.book_id}:${item.cover}`}>
                              <span>
                                {item.quantity} × {item.title} <small>(coperta {item.cover})</small>
                              </span>
                              <span>{money(item.unit_cents * item.quantity)}</span>
                            </li>
                          ))}
                          <li>
                            <span>Livrare</span>
                            <span>{order.shipping_cents ? money(order.shipping_cents) : 'gratuită'}</span>
                          </li>
                          <li className="shop-admin-total">
                            <span>Total</span>
                            <span>{money(order.total_cents)}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    {NEXT_STATUSES[order.status].length > 0 && (
                      <div className="shop-admin-actions">
                        {NEXT_STATUSES[order.status].map(next =>
                          next === 'cancelled' ? (
                            <button
                              key={next}
                              className="secondary-button shop-admin-cancel"
                              disabled={locked}
                              onClick={() => setCancelling(order)}
                            >
                              {actionLabel[next]}
                            </button>
                          ) : (
                            <button
                              key={next}
                              className="primary-button"
                              disabled={locked}
                              onClick={() => void move(order, next)}
                            >
                              {actionLabel[next]}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
        {data && (offset > 0 || data.hasMore) && (
          <div className="admin-list-pagination">
            <button className="secondary-button" disabled={locked || offset === 0} onClick={() => refresh(offset - 20)}>
              Înapoi
            </button>
            <button
              className="secondary-button"
              disabled={locked || !data.hasMore}
              onClick={() => refresh(offset + 20)}
            >
              Mai departe
            </button>
          </div>
        )}
      </section>
      <AlertDialog open={Boolean(cancelling)} onOpenChange={open => !open && !busy && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulezi comanda nr. {cancelling?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Comanda nu mai poate fi reluată după anulare. Exemplarele revin în stoc. Anunță clientul, dacă nu a cerut
              chiar el anularea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Renunță</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={event => {
                event.preventDefault();
                if (cancelling) void move(cancelling, 'cancelled');
              }}
            >
              Anulează comanda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ShopAdminFrame>
  );
}
