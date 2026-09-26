/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation with the existing administration. */
import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import type { Book } from '@/lib/book-types';
import { listBooks } from '@/db/books';
import BookAdmin from './book-admin';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Administrare cărți — Poetio', robots: { index: false, follow: false } };
export default async function BookAdminPage() {
  const user = await getChatGPTUser();
  const basic = (env as unknown as { ADMIN_AUTH_MODE?: string }).ADMIN_AUTH_MODE === 'basic';
  const signInHref = basic ? '/admin/carti' : chatGPTSignInPath('/admin/carti');
  if (!user || !isOwnerEmail(user.email)) return <main className="unavailable shell" lang="ro"><h1>Administrare cărți</h1><p>Doar proprietarul site-ului poate administra cărțile.</p>{!user && <a className="primary-button" href={signInHref}>Autentificare în administrare</a>}<a className="secondary-button" href="/carti">Vezi cărțile</a></main>;
  let books: Book[] = [];
  let failed = false;
  try { books = await listBooks(getPoemDb()); }
  catch (error) { console.error('Book administration unavailable', error); failed = true; }
  return <BookAdmin initialBooks={books} initialError={failed} signInHref={signInHref} />;
}
