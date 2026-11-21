import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { getShopSettings } from '@/db/shop';
import { publicShop } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import TermsView from './terms-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await requestLanguage()) === 'ro';
  return { title: ro ? 'Termeni și condiții — Poetio' : 'Terms and conditions — Poetio' };
}

export default async function TermsPage() {
  const settings = await getShopSettings(getPoemDb());
  return <TermsView initialLanguage={await requestLanguage()} shop={publicShop(settings)} />;
}
