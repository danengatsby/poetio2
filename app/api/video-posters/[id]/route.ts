import { env } from 'cloudflare:workers';
import { getPoemDb } from '@/db/binding';
import { serveVideoPoster, type VideoPosterRenderer } from '@/db/video-posters';
import { apiError } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const renderer = (env as unknown as { VIDEO_POSTER?: VideoPosterRenderer }).VIDEO_POSTER;
    return await serveVideoPoster(getPoemDb(), renderer, request, (await params).id);
  } catch (error) { return apiError(error); }
}
export const HEAD = GET;
