import { isOwnerEmail } from '../lib/access';
import { etagMatches } from './audio';
import type { Database } from './poems';
import { getVideoFile, validVideoFileId, type StoredVideoFile } from './video-files';

export type VideoPosterRenderer = { render(file: StoredVideoFile): Promise<Uint8Array> };
const missing = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });

// A still frame of a film, public only while the film itself is published.
// Runtimes without a renderer answer 404; pages then show the film directly.
export async function serveVideoPoster(db: Database, renderer: VideoPosterRenderer | undefined, request: Request, id: string) {
  if (!renderer || !validVideoFileId(id)) return missing();
  const file = await getVideoFile(db, id);
  if (!file) return missing();
  const owner = isOwnerEmail(request.headers.get('oai-authenticated-user-email'));
  // Re-check publication before any 304, including browser cache hits.
  if (!owner && !await db.prepare('SELECT id FROM videos WHERE file_id = ? LIMIT 1').bind(id).first()) return missing();
  const etag = `"${file.content_hash}-poster-v1"`;
  const headers = new Headers({ 'Content-Type': 'image/jpeg', 'Cache-Control': owner ? 'private, no-store' : 'private, no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff' });
  if (etagMatches(request, etag)) return new Response(null, { status: 304, headers });
  let bytes: Uint8Array;
  // The renderer reports its own failures to the operations panel.
  try { bytes = await renderer.render(file); } catch { return missing(); }
  headers.set('Content-Length', String(bytes.byteLength));
  return new Response(request.method === 'HEAD' ? null : bytes as BodyInit, { headers });
}
