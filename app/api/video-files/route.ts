import { getMediaValidator } from '@/db/media-binding';
import { getPoemDb } from '@/db/binding';
import { getVideoBucket } from '@/db/video-binding';
import { saveVideoFile } from '@/db/video-files';
import { apiError, requireSameOriginOwner } from '@/lib/access';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOriginOwner(request);
    const file = await saveVideoFile(getPoemDb(), getVideoBucket(), request, getMediaValidator());
    return Response.json({ file: { id: file.id, file_name: file.file_name, url: `/api/video-files/${file.id}` } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
