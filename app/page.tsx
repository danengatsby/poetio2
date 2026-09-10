import { getChatGPTUser } from './chatgpt-auth';
import { cookies } from 'next/headers';
import { SITE_LANGUAGE_COOKIE, siteLanguage, siteCopy } from '@/lib/site-language';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import { listPoems } from '@/db/poems';
import Showcase from './showcase';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  const copy = siteCopy[language];
  const user = await getChatGPTUser();
  const canAdmin = isOwnerEmail(user?.email);
  try { return <Showcase poems={await listPoems(getPoemDb())} canAdmin={canAdmin} initialLanguage={language} />; }
  catch (error) {
    console.error('Collection unavailable', error);
    return <main className="unavailable shell"><a href="/" className="wordmark">Poetio<span>✳</span></a><h1>{copy.unavailableTitle}</h1><p>{copy.unavailable}</p><a className="primary-button" href="/">{copy.retry}</a>{canAdmin && <a className="secondary-button" href="/admin">{copy.administration}</a>}</main>;
  }
}
