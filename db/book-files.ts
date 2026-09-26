import { AppError, isOwnerEmail } from '../lib/access';
import { MAX_BOOK_BYTES } from '../lib/book-types';
import { validImageId } from './images';
import type { Database } from './poems';
import { audioRange, type AudioBucket, type AudioRange } from './audio';

export const validBookFileId = validImageId;
export type StoredBookFile = {
  id: string; object_key: string; file_name: string; content_type: string;
  byte_size: number; content_hash: string; owner_email: string; created_at: number;
};
// Check the PDF signature before storage; the browser renders the document.
export function bookType(bytes: Uint8Array): string {
  if (bytes.length >= 8 && /^%PDF-[12]\.[0-9]/.test(String.fromCharCode(...bytes.subarray(0, 8)))) return 'application/pdf';
  throw new AppError(415, 'Fișierul nu este un PDF valid.');
}

export async function readBookBytes(request: Request) {
  const declared = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const type = declared;
  if (!type || !['application/pdf', 'application/octet-stream'].includes(type)) throw new AppError(415, 'Alege un fișier PDF.');
  const tooLarge = () => new AppError(413, 'Cartea depășește limita de 100 MB.');
  if (Number(request.headers.get('content-length') || 0) > MAX_BOOK_BYTES) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Fișierul PDF lipsește.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BOOK_BYTES) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = bookType(bytes);
  if (type !== 'application/octet-stream' && type !== contentType) throw new AppError(415, 'Tipul fișierului nu corespunde documentului. Alege fișierul PDF original.');
  return { bytes, contentType };
}

export function getBookFile(db: Database, id: string) {
  return db.prepare('SELECT * FROM book_files WHERE id = ?').bind(id).first<StoredBookFile>();
}

export async function saveBookFile(db: Database, bucket: AudioBucket, request: Request) {
  const id = request.headers.get('x-upload-id');
  if (!validBookFileId(id)) throw new AppError(400, 'Identificatorul încărcării este nevalid.');
  const { bytes, contentType } = await readBookBytes(request);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const owner = request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase();
  const existing = await getBookFile(db, id);
  if (existing) {
    if (existing.owner_email !== owner || existing.content_hash !== hash) throw new AppError(409, 'Această încărcare există deja. Selectează fișierul PDF din nou.');
    return existing;
  }
  let fileName = 'carte.pdf';
  try { fileName = decodeURIComponent(request.headers.get('x-file-name') || fileName); } catch { /* Safe display fallback. */ }
  fileName = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, '').slice(0, 200) || 'carte.pdf';
  const key = `books/${id}/${hash}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare('INSERT INTO book_files (id, object_key, file_name, content_type, byte_size, content_hash, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, key, fileName, contentType, bytes.length, hash, owner, Date.now()).run();
  const book = await getBookFile(db, id);
  if (!book || book.owner_email !== owner || book.content_hash !== hash) throw new AppError(409, 'Încărcarea nu a fost confirmată. Selectează fișierul din nou.');
  return book;
}

export async function serveBookFile(db: Database, bucket: AudioBucket, request: Request, id: string) {
  const missing = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  if (!validBookFileId(id)) return missing();
  const book = await getBookFile(db, id);
  if (!book) return missing();
  const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
  if (!owner) return missing();
  const headers = new Headers({ 'Content-Type': book.content_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ETag: `"${book.content_hash}"` });
  headers.set('Content-Disposition', `${new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline'}; filename="carte.pdf"; filename*=UTF-8''${encodeURIComponent(book.file_name).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16))}`);
  let range: AudioRange | null = null;
  // HEAD describes the entire representation; If-Range only permits a partial
  // response for this exact immutable document.
  if (request.method === 'GET' && (!request.headers.has('if-range') || request.headers.get('if-range') === headers.get('etag'))) {
    try { range = audioRange(request.headers.get('range'), book.byte_size); }
    catch (error) {
      if (!(error instanceof AppError) || error.status !== 416) throw error;
      headers.set('Content-Range', `bytes */${book.byte_size}`);
      return new Response(null, { status: 416, headers });
    }
  }
  const object = await bucket.get(book.object_key, range ? { range } : undefined);
  if (!object) return missing();
  headers.set('Content-Length', String(range?.length ?? object.size));
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  if (request.method === 'HEAD') { await object.body.cancel(); return new Response(null, { headers }); }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
