import type { Metadata } from 'next';
import { getPoemDb } from '@/db/binding';
import type { VideoWithCommentCount } from '@/lib/video-types';
import { listVideos } from '@/db/videos';
import { isOwnerEmail } from '@/lib/access';
import { pageMetadata } from '@/lib/content-metadata';
import { requestLanguage } from '@/lib/request-language';
import { getChatGPTUser } from '../chatgpt-auth';
import VideoGallery from './video-gallery';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return pageMetadata({
    title: 'Video — Poetio',
    description: language === 'ro' ? 'Colecția video Poetio.' : 'The Poetio video collection.',
    path: '/video',
    language,
  });
}
export default async function VideoPage() {
  const language = await requestLanguage();
  const canAdmin = isOwnerEmail((await getChatGPTUser())?.email);
  let videos: VideoWithCommentCount[] = [];
  let failed = false;
  try {
    videos = await listVideos(getPoemDb());
  } catch (error) {
    console.error('Video collection unavailable', error);
    failed = true;
  }
  return <VideoGallery videos={videos} initialLanguage={language} canAdmin={canAdmin} failed={failed} />;
}
