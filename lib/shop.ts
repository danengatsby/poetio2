// Shop rules shared by the server and the pages: money, delivery dates, labels.
import { BOOK_PRICE_CURRENCIES, normalizeBookPrice, type BookPriceCurrency } from './book-price';
import { pick } from './site-language';
import type { SiteLanguage } from './poem-types';

export type PaymentMethod = 'cod' | 'transfer';
export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const MAX_ITEM_QUANTITY = 10;
// Each order emails the seller and the address typed in, and holds stock until the owner
// cancels it, so orders cannot be placed in bulk. Cancelled orders still count.
export const ORDER_LIMITS = {
  /** Same email address or same phone number, in 24 hours. */
  perContactPerDay: 3,
  /** From one IP address, in an hour. */
  perAddressPerHour: 5,
  /** The whole shop, in an hour and in 24 hours. */
  perHour: 20,
  perDay: 50,
};

export type ShopSettings = {
  seller_name: string;
  /** Postal address shown in the terms and the withdrawal form (required by OUG 34/2014). */
  seller_address: string;
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
  seller_address: '',
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

/** A multi-line address on one line ("Str. Lungă 2, Iași"). */
export const addressLine = (text: string) =>
  text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(', ');

/** Seller details the law asks for (OUG 34/2014, Legea 365/2002) that are still empty. They do not close the shop. */
export function legalGaps(settings: ShopSettings) {
  const list: string[] = [];
  if (!settings.seller_address) list.push('adresa vânzătorului');
  if (!settings.contact_email) list.push('emailul de contact');
  if (!settings.contact_phone) list.push('telefonul de contact');
  return list;
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

export function formatMoney(cents: number, currency: string, language: SiteLanguage) {
  return new Intl.NumberFormat(pick(language, 'ro-RO', 'en-US', 'fr-FR', 'de-DE', 'es-ES'), {
    style: 'currency',
    currency,
  }).format(cents / 100);
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
  language: SiteLanguage,
) {
  const format = new Intl.DateTimeFormat(pick(language, 'ro-RO', 'en-US', 'fr-FR', 'de-DE', 'es-ES'), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Bucharest',
  });
  const first = format.format(addBusinessDays(now, settings.delivery_min_days));
  const last = format.format(addBusinessDays(now, settings.delivery_max_days));
  return first === last ? first : `${first} – ${last}`;
}

export const paymentLabel = (method: PaymentMethod, language: SiteLanguage) =>
  pick(
    language,
    { cod: 'Ramburs (plătești la livrare)', transfer: 'Transfer bancar' },
    { cod: 'Cash on delivery', transfer: 'Bank transfer' },
    { cod: 'Paiement à la livraison', transfer: 'Virement bancaire' },
    { cod: 'Zahlung bei Lieferung (Nachnahme)', transfer: 'Banküberweisung' },
    { cod: 'Contra reembolso (pagas al recibir)', transfer: 'Transferencia bancaria' },
  )[method];

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

export const BOOK_LANGUAGES: Record<string, { ro: string; en: string; fr: string; de: string; es: string }> = {
  ro: { ro: 'Română', en: 'Romanian', fr: 'Roumain', de: 'Rumänisch', es: 'Rumano' },
  en: { ro: 'Engleză', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés' },
  fr: { ro: 'Franceză', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés' },
  de: { ro: 'Germană', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán' },
  it: { ro: 'Italiană', en: 'Italian', fr: 'Italien', de: 'Italienisch', es: 'Italiano' },
  es: { ro: 'Spaniolă', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español' },
};
