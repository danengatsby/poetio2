import { AppError, isOwnerEmail } from '../lib/access';
import { MAX_PAGE_TEXT, type BookPageText } from '../lib/book-text';
import type { StoredBookFile } from './book-files';
import type { Database } from './poems';

export type TextRenderer = {
  info(file: StoredBookFile): Promise<{ pages: number }>;
  text(file: StoredBookFile, page: number, forceOcr?: boolean): Promise<{ text: string; source: 'pdf' | 'ocr' } | null>;
};
type StoredText = { content: string; language: BookPageText['language']; revision: number };
export function textPageNumber(value: string) {
  if (!/^[1-9][0-9]{0,3}$/.test(value) || Number(value) > 2000) throw new AppError(404, 'Pagina nu există.');
  return Number(value);
}
async function storedText(db: Database, fileId: string, page: number) {
  return db.prepare('SELECT content, language, revision FROM book_page_texts WHERE file_id = ? AND page = ?').bind(fileId, page).first<StoredText>();
}
const corrected = (page: number, row: StoredText): BookPageText => ({ page, text: row.content, language: row.language, source: 'edited', reviewed: true, revision: row.revision });

export async function readBookText(db: Database, file: StoredBookFile, page: number, renderer?: TextRenderer, forceOcr = false, manual = false): Promise<BookPageText> {
  const saved = await storedText(db, file.id, page);
  if (saved && !forceOcr) return corrected(page, saved);
  if (manual) return { page, text: '', source: 'pdf', language: 'und', reviewed: false, revision: 0 };
  if (!renderer?.text) throw new AppError(503, 'Textul nu poate fi extras momentan. Reîncearcă sau consultă pagina originală.');
  const result = await renderer.text(file, page, forceOcr);
  if (!result) throw new AppError(404, 'Pagina nu există.');
  return { ...result, page, language: 'und', reviewed: false, revision: saved?.revision ?? 0 };
}

export async function saveBookText(db: Database, file: StoredBookFile, page: number, input: unknown, renderer?: TextRenderer): Promise<BookPageText> {
  if (!isOwnerEmail(file.owner_email)) throw new AppError(404, 'Fișierul PDF nu există.');
  const data = input as Partial<BookPageText> | null;
  if (!data || typeof data.text !== 'string' || !data.text.trim() || data.text.length > MAX_PAGE_TEXT || !data.language || !['ro', 'en-US', 'und'].includes(data.language) || !Number.isSafeInteger(data.revision) || data.revision! < 0 || data.reviewed !== true) throw new AppError(400, 'Completează textul, limba și confirmă verificarea paginii.');
  if (!renderer?.info) throw new AppError(503, 'Numărul paginilor nu poate fi verificat momentan.');
  const { pages } = await renderer.info(file);
  if (!Number.isSafeInteger(page) || page < 1 || page > pages) throw new AppError(404, 'Pagina nu există.');
  const content = data.text.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if (content.length > MAX_PAGE_TEXT) throw new AppError(400, 'Textul paginii este prea lung.');
  const result = data.revision === 0
    ? await db.prepare('INSERT INTO book_page_texts (file_id, page, content, language, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT (file_id, page) DO NOTHING').bind(file.id, page, content, data.language, Date.now()).run()
    : await db.prepare('UPDATE book_page_texts SET content = ?, language = ?, revision = revision + 1, updated_at = ? WHERE file_id = ? AND page = ? AND revision = ?').bind(content, data.language, Date.now(), file.id, page, data.revision!).run();
  const saved = await storedText(db, file.id, page);
  if (!saved || (!result.meta?.changes && !(saved.revision === data.revision! + 1 && saved.content === content && saved.language === data.language))) throw new AppError(409, 'Textul a fost modificat în altă sesiune. Copiază modificările tale și reîncarcă pagina înainte de salvare.');
  return corrected(page, saved);
}
