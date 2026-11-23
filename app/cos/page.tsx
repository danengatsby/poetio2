import type { Metadata } from 'next';
import { requestLanguage } from '@/lib/request-language';
import CartView from './cart-view';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: pick(
      language,
      'Coșul de cumpărături — Poetio',
      'Shopping cart — Poetio',
      'Panier — Poetio',
      'Warenkorb — Poetio',
      'Carrito — Poetio',
      'Carrello — Poetio',
    ),
    robots: { index: false },
  };
}

export default async function CartPage() {
  return <CartView initialLanguage={await requestLanguage()} />;
}
