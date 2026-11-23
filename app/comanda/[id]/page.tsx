import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPoemDb } from '@/db/binding';
import { getCustomerOrder, getShopSettings } from '@/db/shop';
import { deliveryWindow, publicShop } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import OrderView from './order-view';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: pick(
      language,
      'Comanda ta — Poetio',
      'Your order — Poetio',
      'Votre commande — Poetio',
      'Ihre Bestellung — Poetio',
      'Tu pedido — Poetio',
      'Il tuo ordine — Poetio',
    ),
    robots: { index: false, follow: false },
    // The link carries the order key; keep it out of other sites' logs.
    referrer: 'no-referrer',
  };
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrderPage({ params, searchParams }: Props) {
  const db = getPoemDb();
  const order = await getCustomerOrder(db, (await params).id, (await searchParams).cheie);
  if (!order) notFound();
  const settings = await getShopSettings(db);
  const placed = new Date(order.created_at);
  return (
    <OrderView
      initialLanguage={await requestLanguage()}
      order={order}
      shop={publicShop(settings)}
      delivery={{
        ro: deliveryWindow(placed, settings, 'ro'),
        'en-US': deliveryWindow(placed, settings, 'en-US'),
        fr: deliveryWindow(placed, settings, 'fr'),
        de: deliveryWindow(placed, settings, 'de'),
        es: deliveryWindow(placed, settings, 'es'),
        it: deliveryWindow(placed, settings, 'it'),
      }}
    />
  );
}
