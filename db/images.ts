import { AppError, isOwnerEmail } from '../lib/access';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../lib/poem-images';
import type { Database } from './poems';

export type StoredImage = {
  id: string; object_key: string; file_name: string; content_type: string;
  byte_size: number; content_hash: string; owner_email: string; created_at: number;
};
export type ImageBucket = {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
};

export function validImageId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function imageType(bytes: Uint8Array): string {
  if (bytes.length < 24) throw new AppError(415, 'Fișierul nu este o imagine JPG, PNG sau WebP validă.');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value) && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR') return 'image/png';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(String.fromCharCode(...bytes.slice(12,16)))) return 'image/webp';
  throw new AppError(415, 'Alege o imagine JPG, PNG sau WebP. Alte tipuri de fișiere nu sunt acceptate.');
}

export async function readImageBytes(request: Request) {
  const declared = request.headers.get('content-type')?.split(';')[0].trim();
  if (!declared || !IMAGE_TYPES.includes(declared)) throw new AppError(415, 'Alege o imagine JPG, PNG sau WebP.');
  if (Number(request.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) throw new AppError(413, 'Imaginea depășește limita de 5 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Imaginea lipsește.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_IMAGE_BYTES) { await reader.cancel(); throw new AppError(413, 'Imaginea depășește limita de 5 MB.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = imageType(bytes);
  if (declared !== contentType) throw new AppError(415, 'Tipul fișierului nu corespunde imaginii. Alege un fișier JPG, PNG sau WebP valid.');
  return { bytes, contentType };
}

export function getImage(db: Database, id: string) {
  return db.prepare('SELECT * FROM poem_images WHERE id = ?').bind(id).first<StoredImage>();
}

export async function requireAvailableImage(db: Database, id: string | null | undefined) {
  if (!id) return;
  if (!validImageId(id)) throw new AppError(400, 'Imaginea selectată este nevalidă.');
  const image = await getImage(db, id);
  if (!image || !isOwnerEmail(image.owner_email)) throw new AppError(400, 'Imaginea nu a fost încărcată în acest cont. Încarcă imaginea din nou.');
}

export async function saveImage(db: Database, bucket: ImageBucket, request: Request) {
  const id = request.headers.get('x-upload-id');
  if (!validImageId(id)) throw new AppError(400, 'Identificatorul încărcării este nevalid.');
  const { bytes, contentType } = await readImageBytes(request);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const owner = request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase();
  const existing = await getImage(db, id);
  if (existing) {
    if (existing.owner_email !== owner || existing.content_hash !== hash) throw new AppError(409, 'Această încărcare există deja. Selectează imaginea din nou.');
    return existing;
  }
  let fileName = 'imagine';
  try { fileName = decodeURIComponent(request.headers.get('x-file-name') || 'imagine'); } catch { /* Safe display fallback. */ }
  fileName = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, '').slice(0, 200) || 'imagine';
  // Including the digest avoids overwriting another upload in concurrent retries.
  const key = `poem-images/${id}/${hash}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare('INSERT INTO poem_images (id, object_key, file_name, content_type, byte_size, content_hash, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, key, fileName, contentType, bytes.length, hash, owner, Date.now()).run();
  const image = await getImage(db, id);
  if (!image || image.owner_email !== owner || image.content_hash !== hash) throw new AppError(409, 'Încărcarea imaginii nu a fost confirmată. Selectează imaginea din nou.');
  return image;
}
