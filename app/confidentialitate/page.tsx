import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { getShopSettings } from '@/db/shop';
import { publicShop } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import PrivacyView from './privacy-view';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: pick(
      language,
      'Confidențialitate — Poetio',
      'Privacy — Poetio',
      'Confidentialité — Poetio',
      'Datenschutz — Poetio',
    ),
  };
}

export default async function PrivacyPage() {
  const settings = await getShopSettings(getPoemDb());
  return <PrivacyView initialLanguage={await requestLanguage()} shop={publicShop(settings)} />;
}
