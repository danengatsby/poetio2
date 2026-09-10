import { getPoemDb } from '@/db/binding';
import { getImageBucket } from '@/db/image-binding';
import { saveImage } from '@/db/images';
import { apiError, requireSameOriginOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOriginOwner(request);
    const image = await saveImage(getPoemDb(), getImageBucket(), request);
    return Response.json({ image: { id: image.id, url: `/api/images/${image.id}`, file_name: image.file_name } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
