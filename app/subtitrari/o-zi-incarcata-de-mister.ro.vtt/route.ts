/// <reference types="vite/client" />
import { getPoemDb } from '@/db/binding';
import { pilotSubtitles } from '@/lib/video-types';
import subtitles from './subtitrare.vtt?raw';

export const dynamic = 'force-dynamic';

export async function GET() {
  const published = await getPoemDb()
    .prepare('SELECT id FROM videos WHERE file_id=? LIMIT 1')
    .bind(pilotSubtitles.fileId)
    .first();
  if (!published) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return new Response(subtitles, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
}
