// Shop rules shared by the server and the pages: money, delivery dates, labels.
import { BOOK_PRICE_CURRENCIES, normalizeBookPrice, type BookPriceCurrency } from './book-price';

export type PaymentMethod = 'cod' | 'transfer';
export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const MAX_ITEM_QUANTITY = 10;

export type ShopSettings = {
  seller_name: string;
  seller_details: string;
  contact_email: string;
  contact_phone: string;
  currency: BookPriceCurrency;
  shipping_amount: string; // "15.00"; "0.00" is free delivery; '' means not set yet
  delivery_min_days: number;
  delivery_max_days: number;
  cod_enabled: boolean;
  transfer_enabled: boolean;
  transfer_iban: string;
  transfer_bank: string;
  transfer_beneficiary: string;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  seller_name: '',
  seller_details: '',
  contact_email: '',
  contact_phone: '',
  currency: 'RON',
  shipping_amount: '',
  delivery_min_days: 2,
  delivery_max_days: 4,
  cod_enabled: true,
  transfer_enabled: false,
  transfer_iban: '',
  transfer_bank: '',
  transfer_beneficiary: '',
};

/** What a visitor may see: everything but nothing secret (there is nothing secret here). */
export type PublicShop = ShopSettings & { ready: boolean; payment_methods: PaymentMethod[] };

export function paymentMethods(settings: ShopSettings): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (settings.cod_enabled) methods.push('cod');
  if (settings.transfer_enabled && settings.transfer_iban) methods.push('transfer');
  return methods;
}

/** Orders open once the seller, a contact, the delivery price and a payment method are set. */
export function shopReady(settings: ShopSettings) {
  return Boolean(
    settings.seller_name &&
    (settings.contact_email || settings.contact_phone) &&
    settings.shipping_amount !== '' &&
    paymentMethods(settings).length,
  );
}

export function publicShop(settings: ShopSettings): PublicShop {
  return { ...settings, ready: shopReady(settings), payment_methods: paymentMethods(settings) };
}

/** Cents and currency of a stored price ("10.00 USD"), or null. */
export function priceCents(value: string | null | undefined) {
  const stored = normalizeBookPrice(value);
  if (!stored) return null;
  const [amount, currency] = stored.split(' ');
  return { cents: Math.round(Number(amount) * 100), currency: currency as BookPriceCurrency };
}

export function amountCents(amount: string) {
  return /^\d{1,6}\.\d{2}$/.test(amount) ? Math.round(Number(amount) * 100) : null;
}

export function formatMoney(cents: number, currency: string, language: 'ro' | 'en-US') {
  return new Intl.NumberFormat(language === 'ro' ? 'ro-RO' : 'en-US', { style: 'currency', currency }).format(
    cents / 100,
  );
}

export const isCurrency = (value: unknown): value is BookPriceCurrency =>
  (BOOK_PRICE_CURRENCIES as readonly unknown[]).includes(value);

function addBusinessDays(start: Date, days: number) {
  const date = new Date(start);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return date;
}

/** "Thursday, 27 November – Tuesday, 2 December", counting working days from today. */
export function deliveryWindow(
  now: Date,
  settings: Pick<ShopSettings, 'delivery_min_days' | 'delivery_max_days'>,
  language: 'ro' | 'en-US',
) {
  const format = new Intl.DateTimeFormat(language === 'ro' ? 'ro-RO' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Bucharest',
  });
  const first = format.format(addBusinessDays(now, settings.delivery_min_days));
  const last = format.format(addBusinessDays(now, settings.delivery_max_days));
  return first === last ? first : `${first} – ${last}`;
}

export const paymentLabel = (method: PaymentMethod, language: 'ro' | 'en-US') =>
  language === 'ro'
    ? { cod: 'Ramburs (plătești la livrare)', transfer: 'Transfer bancar' }[method]
    : { cod: 'Cash on delivery', transfer: 'Bank transfer' }[method];

export const statusLabel: Record<OrderStatus, string> = {
  new: 'Nouă',
  confirmed: 'Confirmată',
  shipped: 'Expediată',
  delivered: 'Livrată',
  cancelled: 'Anulată',
};

/** Which status may follow which; a cancelled or delivered order is final. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const BOOK_LANGUAGES: Record<string, { ro: string; en: string }> = {
  ro: { ro: 'Română', en: 'Romanian' },
  en: { ro: 'Engleză', en: 'English' },
  fr: { ro: 'Franceză', en: 'French' },
  de: { ro: 'Germană', en: 'German' },
  it: { ro: 'Italiană', en: 'Italian' },
  es: { ro: 'Spaniolă', en: 'Spanish' },
};
