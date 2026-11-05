import { getMediaValidator } from '@/db/media-binding';
import { getPoemDb } from '@/db/binding';
import { createVideo, listVideos } from '@/db/videos';
import { apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  try { requireOwner(request); return Response.json({ videos: await listVideos(getPoemDb()) }, { headers }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    requireSafeMutation(request);
    const data = await readJson(request);
    return Response.json({ video: await createVideo(getPoemDb(), data?.id, data, getMediaValidator()) }, { status: 201, headers });
  } catch (error) { return apiError(error); }
}
