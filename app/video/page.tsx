import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getPoemDb } from '@/db/binding';
import type { VideoWithCommentCount } from '@/lib/video-types';
import { listVideos } from '@/db/videos';
import { isOwnerEmail } from '@/lib/access';
import { SITE_LANGUAGE_COOKIE, siteLanguage } from '@/lib/site-language';
import { getChatGPTUser } from '../chatgpt-auth';
import VideoGallery from './video-gallery';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Video — Poetio', description: 'Colecția video Poetio.' };
export default async function VideoPage() {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let videos: VideoWithCommentCount[] = [];
  let failed = false;
  try { videos = await listVideos(getPoemDb()); }
  catch (error) { console.error('Video collection unavailable', error); failed = true; }
  return <VideoGallery videos={videos} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
