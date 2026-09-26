import { env } from 'cloudflare:workers';
import { AppError, isOwnerEmail } from '../lib/access';
import { getBookFile, validBookFileId, type StoredBookFile } from './book-files';
import type { Database } from './poems';
type Renderer = { info(file: StoredBookFile): Promise<{ pages: number }>; page(file: StoredBookFile, page: number): Promise<Uint8Array | null> };
export async function readableBookFile(db: Database, request: Request, id: string) {
  if (!validBookFileId(id)) throw new AppError(404, 'Cartea nu este disponibilă.');
  const file = await getBookFile(db, id);
  if (!file || (!isOwnerEmail(request.headers.get('oai-authenticated-user-email')) && !await db.prepare('SELECT id FROM books WHERE file_id = ? LIMIT 1').bind(id).first())) throw new AppError(404, 'Cartea nu este disponibilă.');
  return file;
}
export function getBookRenderer() {
  const renderer = (env as unknown as { BOOK_RENDERER?: Renderer }).BOOK_RENDERER;
  if (!renderer) throw new AppError(503, 'Cititorul cărții nu este disponibil momentan.');
  return renderer;
}
export function bookPageError(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } });
  console.error('Book page rendering failed', error);
  return Response.json({ error: 'Pagina cărții nu poate fi încărcată momentan. Reîncearcă.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
}
