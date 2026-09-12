import { AppError, isOwnerEmail } from '../lib/access';
import { MAX_AUDIO_BYTES } from '../lib/poem-audio';
import { validImageId } from './images';
import type { Database } from './poems';

export const validAudioId = validImageId;
export type StoredAudio = {
  id: string; object_key: string; file_name: string; content_type: string;
  byte_size: number; content_hash: string; owner_email: string; created_at: number;
};
export type AudioRange = { offset: number; length: number };
export type AudioBucket = {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType: string } }): Promise<unknown>;
  get(key: string, options?: { range: AudioRange }): Promise<{ body: ReadableStream; size: number } | null>;
};

// Check the container signature as well as the declared type. Playback still
// depends on the recording's codec being supported by the listener's browser.
export function audioType(bytes: Uint8Array): string {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 44 && text(0, 4) === 'RIFF' && text(8, 12) === 'WAVE') return 'audio/wav';
  if (bytes.length >= 32 && text(4, 8) === 'ftyp' && /^(M4A |M4B |isom|iso2|mp41|mp42)$/.test(text(8, 12))) return 'audio/mp4';
  if (bytes.length >= 36 && text(0, 4) === 'OggS' && bytes[4] === 0) {
    const packet = 27 + bytes[26];
    if (text(packet, packet + 8) === 'OpusHead' || text(packet, packet + 7) === '\x01vorbis') return 'audio/ogg';
  }
  let frame = 0;
  if (text(0, 3) === 'ID3' && bytes.length >= 10 && [3, 4].includes(bytes[3]) && bytes.subarray(6, 10).every(byte => byte < 128)) {
    frame = 10 + bytes[6] * 2097152 + bytes[7] * 16384 + bytes[8] * 128 + bytes[9];
    if (bytes[3] === 4 && (bytes[5] & 0x10)) frame += 10;
  }
  if (frame + 4 <= bytes.length && bytes[frame] === 0xff && (bytes[frame + 1] & 0xe0) === 0xe0 &&
    (bytes[frame + 1] & 0x18) !== 0x08 && (bytes[frame + 1] & 0x06) !== 0 &&
    (bytes[frame + 2] & 0xf0) !== 0xf0 && (bytes[frame + 2] & 0xf0) !== 0 && (bytes[frame + 2] & 0x0c) !== 0x0c) return 'audio/mpeg';
  throw new AppError(415, 'Fișierul nu este o înregistrare MP3, WAV, M4A sau OGG validă.');
}

export async function readAudioBytes(request: Request) {
  const declared = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const aliases: Record<string, string> = { 'audio/mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/x-m4a': 'audio/mp4', 'application/ogg': 'audio/ogg' };
  const type = aliases[declared || ''] || declared;
  if (!type || !['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'application/octet-stream'].includes(type)) throw new AppError(415, 'Alege un fișier MP3, WAV, M4A sau OGG.');
  const tooLarge = () => new AppError(413, 'Înregistrarea depășește limita de 25 MB.');
  if (Number(request.headers.get('content-length') || 0) > MAX_AUDIO_BYTES) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Înregistrarea audio lipsește.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_AUDIO_BYTES) { await reader.cancel(); throw tooLarge(); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const contentType = audioType(bytes);
  if (type !== 'application/octet-stream' && type !== contentType) throw new AppError(415, 'Tipul fișierului nu corespunde înregistrării. Alege fișierul audio original.');
  return { bytes, contentType };
}

export function getAudio(db: Database, id: string) {
  return db.prepare('SELECT * FROM poem_audio WHERE id = ?').bind(id).first<StoredAudio>();
}

export async function requireAvailableAudio(db: Database, id: string | null | undefined) {
  if (!id) return;
  if (!validAudioId(id)) throw new AppError(400, 'Înregistrarea selectată este nevalidă.');
  const audio = await getAudio(db, id);
  if (!audio || !isOwnerEmail(audio.owner_email)) throw new AppError(400, 'Înregistrarea nu a fost încărcată în acest cont. Încarcă fișierul din nou.');
}

export async function saveAudio(db: Database, bucket: AudioBucket, request: Request) {
  const id = request.headers.get('x-upload-id');
  if (!validAudioId(id)) throw new AppError(400, 'Identificatorul încărcării este nevalid.');
  const { bytes, contentType } = await readAudioBytes(request);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const owner = request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase();
  const existing = await getAudio(db, id);
  if (existing) {
    if (existing.owner_email !== owner || existing.content_hash !== hash) throw new AppError(409, 'Această încărcare există deja. Selectează înregistrarea din nou.');
    return existing;
  }
  let fileName = 'inregistrare';
  try { fileName = decodeURIComponent(request.headers.get('x-file-name') || fileName); } catch { /* Safe display fallback. */ }
  fileName = fileName.replace(/[\u0000-\u001f\u007f/\\]/g, '').slice(0, 200) || 'inregistrare';
  const key = `poem-audio/${id}/${hash}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType } });
  await db.prepare('INSERT INTO poem_audio (id, object_key, file_name, content_type, byte_size, content_hash, owner_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, key, fileName, contentType, bytes.length, hash, owner, Date.now()).run();
  const audio = await getAudio(db, id);
  if (!audio || audio.owner_email !== owner || audio.content_hash !== hash) throw new AppError(409, 'Încărcarea nu a fost confirmată. Selectează fișierul din nou.');
  return audio;
}

export function audioRange(header: string | null, size: number): AudioRange | null {
  // Unsupported units/multipart ranges may be ignored, returning the full file.
  if (!header || !/^bytes=\d*-\d*$/.test(header)) return null;
  const [start, end] = header.slice(6).split('-');
  if (!start && !end) return null;
  const offset = start ? Number(start) : Math.max(0, size - Number(end));
  const last = start && end ? Math.min(Number(end), size - 1) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(last) || offset >= size || last < offset || (!start && Number(end) === 0)) throw new AppError(416, 'Interval audio indisponibil.');
  return { offset, length: last - offset + 1 };
}

export async function serveAudio(db: Database, bucket: AudioBucket, request: Request, id: string) {
  const missing = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  if (!validAudioId(id)) return missing();
  const audio = await getAudio(db, id);
  if (!audio) return missing();
  const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
  if (!owner && !await db.prepare('SELECT id FROM poems WHERE audio_ro_id = ? OR audio_en_id = ? LIMIT 1').bind(id, id).first()) return missing();
  const headers = new Headers({ 'Content-Type': audio.content_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ETag: `"${audio.content_hash}"` });
  let range: AudioRange | null = null;
  // HEAD describes the entire representation; If-Range only permits a partial
  // response for this exact immutable recording.
  if (request.method === 'GET' && (!request.headers.has('if-range') || request.headers.get('if-range') === headers.get('etag'))) {
    try { range = audioRange(request.headers.get('range'), audio.byte_size); }
    catch (error) {
      if (!(error instanceof AppError) || error.status !== 416) throw error;
      headers.set('Content-Range', `bytes */${audio.byte_size}`);
      return new Response(null, { status: 416, headers });
    }
  }
  const object = await bucket.get(audio.object_key, range ? { range } : undefined);
  if (!object) return missing();
  headers.set('Content-Length', String(range?.length ?? object.size));
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
  if (request.method === 'HEAD') { await object.body.cancel(); return new Response(null, { headers }); }
  return new Response(object.body, { status: range ? 206 : 200, headers });
}
