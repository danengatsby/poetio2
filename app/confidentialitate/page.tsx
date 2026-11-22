import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { getShopSettings } from '@/db/shop';
import { publicShop } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import PrivacyView from './privacy-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const ro = (await requestLanguage()) === 'ro';
  return { title: ro ? 'Confidențialitate — Poetio' : 'Privacy — Poetio' };
}

export default async function PrivacyPage() {
  const settings = await getShopSettings(getPoemDb());
  return <PrivacyView initialLanguage={await requestLanguage()} shop={publicShop(settings)} />;
}
