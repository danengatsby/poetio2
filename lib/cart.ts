'use client';
// The visitor's cart, kept in this browser only until the order is placed.
import { useSyncExternalStore } from 'react';
import { MAX_ITEM_QUANTITY } from './shop';

export type CartItem = { book_id: string; cover: 1 | 2; quantity: number };
const KEY = 'poetio-cart';
const EVENT = 'poetio-cart-change';

const valid = (item: unknown): item is CartItem => {
  const data = item as CartItem;
  return (
    Boolean(data) &&
    typeof data.book_id === 'string' &&
    (data.cover === 1 || data.cover === 2) &&
    Number.isInteger(data.quantity) &&
    data.quantity >= 1 &&
    data.quantity <= MAX_ITEM_QUANTITY
  );
};

function read(raw: string | null): CartItem[] {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value.filter(valid).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function raw() {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

export function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked: the cart lasts only for this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(item: CartItem) {
  const items = read(raw());
  const existing = items.find(entry => entry.book_id === item.book_id && entry.cover === item.cover);
  if (existing) existing.quantity = Math.min(MAX_ITEM_QUANTITY, existing.quantity + item.quantity);
  else items.push(item);
  writeCart(items.slice(0, 10));
}

export const clearCart = () => writeCart([]);

function subscribe(change: () => void) {
  window.addEventListener('storage', change);
  window.addEventListener(EVENT, change);
  return () => {
    window.removeEventListener('storage', change);
    window.removeEventListener(EVENT, change);
  };
}

/** The cart, updated across components and tabs. Empty while the page is rendered on the server. */
export function useCart() {
  const text = useSyncExternalStore(subscribe, raw, () => '[]');
  return read(text);
}

export const cartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);
