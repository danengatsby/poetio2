import type { Metadata } from 'next';
import { validImageId } from '@/db/images';
import { MAX_ITEM_QUANTITY } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import CheckoutView from './checkout-view';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: pick(
      language,
      'Finalizează comanda — Poetio',
      'Checkout — Poetio',
      'Commande — Poetio',
      'Kasse — Poetio',
      'Finalizar pedido — Poetio',
      'Cassa — Poetio',
    ),
    robots: { index: false },
  };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CheckoutPage({ searchParams }: Props) {
  const search = await searchParams;
  // "Buy now" orders one book without touching the cart.
  const quantity = Number(search.cantitate ?? 1);
  const direct =
    validImageId(search.carte) &&
    (search.coperta === '1' || search.coperta === '2') &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_ITEM_QUANTITY
      ? { book_id: search.carte as string, cover: Number(search.coperta) as 1 | 2, quantity }
      : null;
  return <CheckoutView initialLanguage={await requestLanguage()} direct={direct} />;
}
