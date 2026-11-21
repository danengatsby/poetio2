import type { Metadata } from 'next';
import { requestLanguage } from '@/lib/request-language';
import CartView from './cart-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await requestLanguage()) === 'ro';
  return { title: ro ? 'Coșul de cumpărături — Poetio' : 'Shopping cart — Poetio', robots: { index: false } };
}

export default async function CartPage() {
  return <CartView initialLanguage={await requestLanguage()} />;
}
