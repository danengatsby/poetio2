import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import { listPoems } from '@/db/poems';
import Admin from './poem-admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Administrare poeme — Poetio', robots: { index: false, follow: false } };

async function OwnerContent() {
  const runtime = env as unknown as { OPENAI_API_KEY?: string; ADMIN_AUTH_MODE?: string };
  const passwordAuth = runtime.ADMIN_AUTH_MODE === 'basic';
  const signInHref = passwordAuth ? '/admin' : chatGPTSignInPath('/admin');
  const user = await getChatGPTUser();
  if (!user) return <main className="unavailable shell" lang="ro"><a href="/" className="wordmark">Poetio<span>✳</span></a><h1>Administrare privată</h1><p>{passwordAuth ? 'Autentifică-te cu utilizatorul și parola de administrare pentru a administra poemele.' : 'Autentifică-te cu contul ChatGPT al proprietarului pentru a administra poemele.'}</p><a className="primary-button" href={signInHref} target="_top">{passwordAuth ? 'Autentificare în administrare' : 'Autentificare cu ChatGPT'}</a><a className="secondary-button" href="/">Înapoi la colecție</a></main>;
  if (!isOwnerEmail(user.email)) return <main className="unavailable shell" lang="ro"><h1>Acces restricționat</h1><p>Doar proprietarul site-ului poate adăuga, modifica și șterge poeme.</p><a className="primary-button" href="/">Înapoi la colecție</a></main>;
  const translationReady = Boolean(runtime.OPENAI_API_KEY?.trim());
  try { return <Admin initialPoems={await listPoems(getPoemDb())} initialError={false} translationReady={translationReady} signInHref={signInHref} />; }
  catch (error) { console.error('Admin collection unavailable', error); return <Admin initialPoems={[]} initialError translationReady={translationReady} signInHref={signInHref} />; }
}

export default function AdminPage() { return <OwnerContent />; }
