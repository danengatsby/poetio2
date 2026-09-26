import { AppError, isOwnerEmail } from '../lib/access';
import { getImage, validImageId, type ImageBucket, type StoredImage } from './images';
import type { Database } from './poems';

export type ImageRenderer = { render(file: StoredImage, width: number): Promise<Uint8Array> };
const widths = [320, 480, 640, 960, 1280];
const missing = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

export async function serveImage(db: Database, bucket: ImageBucket, renderer: ImageRenderer | undefined, request: Request, id: string) {
  if (!validImageId(id)) return missing();
  const query = new URL(request.url).searchParams;
  const width = query.has('w') ? Number(query.get('w')) : null;
  if (width !== null && !widths.includes(width)) throw new AppError(400, 'Dimensiunea imaginii este nevalidă.');
  const image = await getImage(db, id);
  if (!image) return missing();
  const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
  // Re-check attachment before any 304 or derivative response, including cache hits.
  if (!owner && !await db.prepare('SELECT id FROM poems WHERE image_id = ? LIMIT 1').bind(id).first() && !await db.prepare('SELECT id FROM books WHERE image_id = ? LIMIT 1').bind(id).first()) return missing();
  const optimized = width !== null && renderer;
  const etag = `"${image.content_hash}${optimized ? `-webp-v1-${width}` : ''}"`;
  const headers = new Headers({ 'Content-Type': optimized ? 'image/webp' : image.content_type,
    'Cache-Control': owner ? 'private, no-store' : 'private, no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff' });
  const matches = request.headers.get('if-none-match')?.split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag);
  if (matches) return new Response(null, { status: 304, headers });
  if (optimized) {
    const bytes = await renderer.render(image, width);
    headers.set('Content-Length', String(bytes.byteLength));
    return new Response(request.method === 'HEAD' ? null : bytes as BodyInit, { headers });
  }
  const object = await bucket.get(image.object_key);
  if (!object) return missing();
  headers.set('Content-Length', String(object.size));
  if (request.method === 'HEAD') { await object.body.cancel(); return new Response(null, { headers }); }
  return new Response(object.body, { headers });
}
