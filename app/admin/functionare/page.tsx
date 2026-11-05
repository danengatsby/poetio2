/* eslint-disable @next/next/no-html-link-for-pages -- Private administration uses document navigation. */
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import OperationsPanel from './operations-panel';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Funcționare — Poetio', robots: { index: false, follow: false } };
export default async function OperationsPage() {
  const user = await getChatGPTUser();
  if (!user || !isOwnerEmail(user.email)) {
    const basic = (env as unknown as { ADMIN_AUTH_MODE?: string }).ADMIN_AUTH_MODE === 'basic';
    return <main className="unavailable shell" lang="ro"><h1>Funcționare</h1><p>Panoul este disponibil numai proprietarului site-ului.</p>{!user && <a className="primary-button" href={basic ? '/admin/functionare' : chatGPTSignInPath('/admin/functionare')}>Autentificare în administrare</a>}<a href="/">Vezi colecția</a></main>;
  }
  return <OperationsPanel />;
}
