// A book's optional price per cover, stored as "<amount> <currency>", e.g. "10.00 USD".
import { pick } from './site-language';
import type { SiteLanguage } from './poem-types';
export const BOOK_PRICE_CURRENCIES = ['RON', 'EUR', 'USD', 'GBP'] as const;
export type BookPriceCurrency = (typeof BOOK_PRICE_CURRENCIES)[number];

/**
 * The stored form of a price typed in the editor ("10", "10,5 EUR", "1234.50 RON"),
 * null for an empty value, or undefined when it cannot be read.
 */
export function normalizeBookPrice(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return null;
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?\s+([A-Za-z]{3})$/.exec(text);
  if (!match) return undefined;
  const currency = match[3].toUpperCase();
  if (!(BOOK_PRICE_CURRENCIES as readonly string[]).includes(currency)) return undefined;
  const amount = `${Number(match[1])}.${(match[2] ?? '').padEnd(2, '0')}`;
  return Number(amount) > 0 ? `${amount} ${currency}` : undefined;
}

export function bookPriceParts(value: string | null | undefined) {
  const match = /^(\S*)\s*([A-Z]{3})?$/.exec((value ?? '').trim());
  return {
    amount: match?.[1] ?? '',
    currency: (BOOK_PRICE_CURRENCIES as readonly string[]).includes(match?.[2] ?? '')
      ? (match![2] as BookPriceCurrency)
      : ('RON' as BookPriceCurrency),
  };
}

/** "10,00 USD" in Romanian, "$10.00" in English; null without a valid price. */
export function formatBookPrice(value: string | null | undefined, language: SiteLanguage) {
  const stored = normalizeBookPrice(value);
  if (!stored) return null;
  const [amount, currency] = stored.split(' ');
  return new Intl.NumberFormat(pick(language, 'ro-RO', 'en-US', 'fr-FR'), { style: 'currency', currency }).format(
    Number(amount),
  );
}

/** The formatted price split for display with raised cents: "$", "10", "00", "". */
export function bookPriceDisplay(value: string | null | undefined, language: SiteLanguage) {
  const stored = normalizeBookPrice(value);
  if (!stored) return null;
  const [amount, currency] = stored.split(' ');
  const parts = new Intl.NumberFormat(pick(language, 'ro-RO', 'en-US', 'fr-FR'), {
    style: 'currency',
    currency,
  }).formatToParts(Number(amount));
  const whole = parts.findIndex(part => part.type === 'integer');
  const last = parts.findLastIndex(part => part.type === 'integer' || part.type === 'group');
  const fraction = parts.find(part => part.type === 'fraction')?.value ?? '';
  const text = (list: Intl.NumberFormatPart[]) =>
    list
      .map(part => part.value)
      .join('')
      .trim();
  return {
    before: text(parts.slice(0, whole)),
    whole: text(parts.slice(whole, last + 1)),
    fraction,
    after: text(parts.slice(last + 1).filter(part => part.type !== 'decimal' && part.type !== 'fraction')),
    label: parts.map(part => part.value).join(''),
  };
}
