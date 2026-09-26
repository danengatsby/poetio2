import type { Metadata } from 'next';
import Link from 'next/link';
import { env } from 'cloudflare:workers';
import { getChatGPTUser, chatGPTSignInPath } from '../../chatgpt-auth';
import { isOwnerEmail } from '@/lib/access';
import { getPoemDb } from '@/db/binding';
import type { Video } from '@/lib/video-types';
import { listVideos } from '@/db/videos';
import VideoAdmin from './video-admin';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Administrare video — Poetio', robots: { index: false, follow: false } };
export default async function VideoAdminPage() {
  const user = await getChatGPTUser();
  const basic = (env as unknown as { ADMIN_AUTH_MODE?: string }).ADMIN_AUTH_MODE === 'basic';
  const signInHref = basic ? '/admin/video' : chatGPTSignInPath('/admin/video');
  if (!user || !isOwnerEmail(user.email)) return <main className="unavailable shell" lang="ro"><h1>Administrare video</h1><p>Doar proprietarul site-ului poate administra videourile.</p>{!user && <a className="primary-button" href={signInHref}>Autentificare în administrare</a>}<Link className="secondary-button" href="/video" prefetch={false}>Vezi videourile</Link></main>;
  let videos: Video[] = [];
  let failed = false;
  try { videos = await listVideos(getPoemDb()); }
  catch (error) { console.error('Video administration unavailable', error); failed = true; }
  return <VideoAdmin initialVideos={videos} initialError={failed} signInHref={signInHref} />;
}
