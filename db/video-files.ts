import { AppError, isOwnerEmail } from '../lib/access';
import { MAX_VIDEO_BYTES } from '../lib/video-types';
import { validImageId } from './images';
import type { Database } from './poems';
import { audioRange, type AudioBucket, type AudioRange } from './audio';
import { requireReadyMedia, validateMediaUpload, type MediaValidator } from './media-validation';

export const validVideoFileId = validImageId;
export type StoredVideoFile = {
  id: string; object_key: string; file_name: string; content_type: string;
  byte_size: number; content_hash: string; owner_email: string; created_at: number;
};
// Cheap envelope check; full server decoding is required before persistence.
export function videoType(bytes: Uint8Array): string {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 32 && text(4, 8) === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(text(8, 12))) return 'video/mp4';
  if (bytes.length >= 32 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 && text(4, Math.min(bytes.length, 256)).includes('webm')) return 'video/webm';
  throw new AppError(415, 'Fișierul nu este un video MP4 sau WebM valid.');
}

export async function readVideoBytes(request: Request) {
  const declared = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const type = declared;
  if (!type || !['video/mp4', 'video/webm', 'application/octet-stream'].includes(type)) throw new AppError(415, 'Alege un fișier MP4 sau WebM.');
  const tooLarge = () => new AppError(413, 'Videoul depășește limita de 100 MB.');
  if (Number(request.headers.get('content-length') || 0) > MAX_VIDEO_BYTES) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Fișierul video lipsește.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_VIDEO_BYTES) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = videoType(bytes);
  if (type !== 'application/octet-stream' && type !== contentType) throw new AppError(415, 'Tipul fișierului nu corespunde videoului. Alege fișierul video original.');
  return { bytes, contentType };
}

export function getVideoFile(db: Database, id: string) {
  return db.prepare('SELECT * FROM video_files WHERE id = ?').bind(id).first<StoredVideoFile>();
}

export async function saveVideoFile(db: Database, bucket: AudioBucket, request: Request, validator?: MediaValidator) {
  const id = request.headers.get('x-upload-id');
  if (!validVideoFileId(id)) throw new AppError(400, 'Identificatorul încărcării este nevalid.');
  const { bytes, contentType } = await readVideoBytes(request);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const owner = request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase();
  const existing = await getVideoFile(db, id);
  if (existing) {
    if (existing.owner_email !== owner || existing.content_hash !== hash) throw new AppError(409, 'Această încărcare există deja. Selectează videoul din nou.');
    await requireReadyMedia(existing, 'video', validator);
    return existing;
  }
  await validateMediaUpload(bytes, 'video', contentType, hash, validator);
  let fileName = 'video';
  try { fileName = decodeURIComponent(request.headers.get('x-file-name') || fileName); } catch { /* Safe display fallback. */ }
  fileName = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, '').slice(0, 200) || 'video';
  const key = `videos/${id}/${hash}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare('INSERT INTO video_files (id, object_key, file_name, content_type, byte_size, content_hash, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, key, fileName, contentType, bytes.length, hash, owner, Date.now()).run();
  const video = await getVideoFile(db, id);
  if (!video || video.owner_email !== owner || video.content_hash !== hash) throw new AppError(409, 'Încărcarea nu a fost confirmată. Selectează fișierul din nou.');
  return video;
}

export async function serveVideoFile(db: Database, bucket: AudioBucket, request: Request, id: string) {
  const missing = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  if (!validVideoFileId(id)) return missing();
  const video = await getVideoFile(db, id);
  if (!video) return missing();
  const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
  if (!owner && !await db.prepare('SELECT id FROM videos WHERE file_id = ? LIMIT 1').bind(id).first()) return missing();
  const headers = new Headers({ 'Content-Type': video.content_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ETag: `"${video.content_hash}"` });
  let range: AudioRange | null = null;
  // HEAD describes the entire representation; If-Range only permits a partial
  // response for this exact immutable recording.
  if (request.method === 'GET' && (!request.headers.has('if-range') || request.headers.get('if-range') === headers.get('etag'))) {
    try { range = audioRange(request.headers.get('range'), video.byte_size); }
    catch (error) {
      if (!(error instanceof AppError) || error.status !== 416) throw error;
      headers.set('Content-Range', `bytes */${video.byte_size}`);
      return new Response(null, { status: 416, headers });
    }
  }
  const object = await bucket.get(video.object_key, range ? { range } : undefined);
  if (!object) return missing();
  headers.set('Content-Length', String(range?.length ?? object.size));
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  if (request.method === 'HEAD') { await object.body.cancel(); return new Response(null, { headers }); }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
