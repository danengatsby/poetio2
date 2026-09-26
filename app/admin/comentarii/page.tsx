/* eslint-disable @next/next/no-html-link-for-pages -- Keep the existing full-document administration navigation. */
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import CommentAdmin from './comment-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moderare comentarii — Poetio', robots: { index: false, follow: false } };

export default async function CommentAdminPage() {
  const user = await getChatGPTUser();
  const basic = (env as unknown as { ADMIN_AUTH_MODE?: string }).ADMIN_AUTH_MODE === 'basic';
  const signInHref = basic ? '/admin/comentarii' : chatGPTSignInPath('/admin/comentarii');
  if (!user || !isOwnerEmail(user.email)) return <main className="unavailable shell" lang="ro"><h1>Moderare comentarii</h1><p>Doar proprietarul site-ului poate administra comentariile.</p>{!user && <a className="primary-button" href={signInHref}>Autentificare în administrare</a>}<a className="secondary-button" href="/">Vezi colecția</a></main>;
  return <CommentAdmin signInHref={signInHref} />;
}
