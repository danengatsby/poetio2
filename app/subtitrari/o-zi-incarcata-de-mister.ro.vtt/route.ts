/// <reference types="vite/client" />
import { getPoemDb } from '@/db/binding';
import { pilotSubtitles } from '@/lib/video-types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const published = await getPoemDb()
    .prepare("SELECT subtitle_text FROM videos WHERE file_id=? AND subtitle_language='ro' ORDER BY id LIMIT 1")
    .bind(pilotSubtitles.fileId)
    .first<{ subtitle_text: string }>();
  if (!published?.subtitle_text)
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return new Response(published.subtitle_text, {
    headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    },
  });
}
