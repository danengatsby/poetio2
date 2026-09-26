import { getChatGPTUser } from './chatgpt-auth';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { SITE_LANGUAGE_COOKIE, siteLanguage, siteCopy } from '@/lib/site-language';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import { listPoems } from '@/db/poems';
import type { PoemWithCommentCount } from '@/lib/poem-types';
import Showcase from './showcase';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  const copy = siteCopy[language];
  const user = await getChatGPTUser();
  const canAdmin = isOwnerEmail(user?.email);
  let poems: PoemWithCommentCount[] | null = null;
  try { poems = await listPoems(getPoemDb()); }
  catch (error) {
    console.error('Collection unavailable', error);
  }
  if (poems === null) return <main className="unavailable shell">
    <Link href="/" prefetch={false} className="wordmark">Poetio<span>✳</span></Link>
    <h1>{copy.unavailableTitle}</h1><p>{copy.unavailable}</p>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Retry must reload the current document and rerun the failed database query. */}
    <a className="primary-button" href="/">{copy.retry}</a>
    {canAdmin && <Link className="secondary-button" href="/admin" prefetch={false}>{copy.administration}</Link>}
  </main>;
  return <Showcase poems={poems} canAdmin={canAdmin} initialLanguage={language} />;
}
