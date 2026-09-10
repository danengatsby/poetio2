import { getPoemDb } from '@/db/binding';
import { getImageBucket } from '@/db/image-binding';
import { getImage, validImageId } from '@/db/images';
import { apiError, isOwnerEmail } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!validImageId(id)) return new Response('Not found', { status: 404 });
    const db = getPoemDb();
    const image = await getImage(db, id);
    if (!image) return new Response('Not found', { status: 404 });
    const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
    // Unsaved uploads remain private; collection images inherit Site access.
    if (!owner && !await db.prepare('SELECT id FROM poems WHERE image_id = ? LIMIT 1').bind(id).first()) return new Response('Not found', { status: 404 });
    const object = await getImageBucket().get(image.object_key);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, { headers: { 'Content-Type': image.content_type, 'Content-Length': String(object.size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return apiError(error); }
}
