/* eslint-disable @next/next/no-html-link-for-pages -- Private administration uses document navigation. */
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import OrdersAdmin from './orders-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Comenzi — Poetio', robots: { index: false, follow: false } };

export default async function Page() {
  const user = await getChatGPTUser();
  if (!user || !isOwnerEmail(user.email)) {
    const basic = (env as unknown as { ADMIN_AUTH_MODE?: string }).ADMIN_AUTH_MODE === 'basic';
    return (
      <main className="unavailable shell" lang="ro">
        <h1>Comenzi</h1>
        <p>Doar proprietarul site-ului poate vedea comenzile.</p>
        {!user && (
          <a className="primary-button" href={basic ? '/admin/comenzi' : chatGPTSignInPath('/admin/comenzi')}>
            Autentificare în administrare
          </a>
        )}
        <a href="/">Vezi colecția</a>
      </main>
    );
  }
  return <OrdersAdmin />;
}
