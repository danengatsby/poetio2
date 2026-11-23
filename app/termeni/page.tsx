import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import { getShopSettings } from '@/db/shop';
import { publicShop } from '@/lib/shop';
import { requestLanguage } from '@/lib/request-language';
import TermsView from './terms-view';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: pick(
      language,
      'Termeni și condiții — Poetio',
      'Terms and conditions — Poetio',
      'Conditions générales de vente — Poetio',
      'AGB — Poetio',
      'Términos y condiciones — Poetio',
      'Termini e condizioni — Poetio',
    ),
  };
}

export default async function TermsPage() {
  const settings = await getShopSettings(getPoemDb());
  return <TermsView initialLanguage={await requestLanguage()} shop={publicShop(settings)} />;
}
