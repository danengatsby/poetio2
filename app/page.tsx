import { getChatGPTUser } from './chatgpt-auth';
import Link from 'next/link';
import { siteCopy } from '@/lib/site-language';
import { requestLanguage } from '@/lib/request-language';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import { listPoemCards } from '@/db/poem-collection';
import { type CollectionParams, type PoemCollection } from '@/lib/poem-collection';
import Showcase from './showcase';
export const dynamic = 'force-dynamic';
export default async function Home({ searchParams }: { searchParams: Promise<CollectionParams> }) {
  const params = await searchParams;
  const language = await requestLanguage();
  const copy = siteCopy[language];
  const user = await getChatGPTUser();
  const canAdmin = isOwnerEmail(user?.email);
  let collection: PoemCollection | null = null;
  try { collection = await listPoemCards(getPoemDb(), params, language); }
  catch (error) {
    console.error('Collection unavailable', error);
  }
  if (collection === null) return <main className="unavailable shell">
    <Link href="/" prefetch={false} className="wordmark">Poetio<span>✳</span></Link>
    <h1>{copy.unavailableTitle}</h1><p>{copy.unavailable}</p>
    <a className="primary-button" href="">{copy.retry}</a>
    {canAdmin && <Link className="secondary-button" href="/admin" prefetch={false}>{copy.administration}</Link>}
  </main>;
  return <Showcase collection={collection} canAdmin={canAdmin} />;
}
