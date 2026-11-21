'use client';
// Asks the server for current prices, stock and delivery of a list of books.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CartItem } from '@/lib/cart';
import type { Quote } from '@/db/shop';
import type { PublicShop } from '@/lib/shop';

export type QuoteState =
  { status: 'loading' } | { status: 'ready'; quote: Quote; shop: PublicShop } | { status: 'error'; message: string };

const noop = () => () => {};
/** False while the page is rendered on the server and hydrated, true after. */
export const useInBrowser = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

export function useQuote(items: CartItem[]) {
  const key = JSON.stringify(items);
  const [state, setState] = useState<{ key: string; value: QuoteState }>({ key: '', value: { status: 'loading' } });
  useEffect(() => {
    const list = JSON.parse(key) as CartItem[];
    if (!list.length) return;
    const controller = new AbortController();
    fetch('/api/shop/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: list }),
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Coșul nu a putut fi verificat.');
        setState({ key, value: { status: 'ready', quote: data.quote, shop: data.shop } });
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return;
        setState({ key, value: { status: 'error', message: error.message || 'Coșul nu a putut fi verificat.' } });
      });
    return () => controller.abort();
  }, [key]);
  // A result for an older cart is shown as loading until the new one arrives.
  return state.key === key ? state.value : ({ status: 'loading' } as QuoteState);
}
