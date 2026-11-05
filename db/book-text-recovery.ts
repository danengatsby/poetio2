import { AppError, isOwnerEmail } from '../lib/access';
import { textSnapshot, type BookTextSnapshot } from '../lib/book-text-recovery';
import { validImageId } from './images';
import type { StoredBookFile } from './book-files';
import type { TextRenderer } from './book-text';
import type { Database } from './poems';

const kind = 'book-text';
function scope(file: StoredBookFile, page: number) {
  if (!isOwnerEmail(file.owner_email)) throw new AppError(404, 'Fișierul PDF nu există.');
  if (!Number.isSafeInteger(page) || page < 1 || page > 2000) throw new AppError(404, 'Pagina nu există.');
  return `${file.id}:${page}`;
}
function table(source: string) {
  if (source !== 'drafts' && source !== 'history') throw new AppError(400, 'Lista este nevalidă.');
  return source === 'drafts' ? 'content_drafts' : 'content_history';
}
function identifier(source: string, id: string) {
  if (source === 'drafts' ? !validImageId(id) : !/^[1-9][0-9]{0,14}$/.test(id)) throw new AppError(400, 'Identificator nevalid.');
}
export async function saveTextDraft(db: Database, file: StoredBookFile, page: number, id: unknown, value: unknown, renderer?: TextRenderer) {
  const entity = scope(file, page), snapshot = textSnapshot(value);
  if (!validImageId(id) || !snapshot || snapshot.fileId !== file.id || snapshot.page !== page) throw new AppError(400, 'Schița nu corespunde fișierului și paginii.');
  if (!renderer?.info) throw new AppError(503, 'Numărul paginilor nu poate fi verificat momentan.');
  if (page > (await renderer.info(file)).pages) throw new AppError(404, 'Pagina nu există.');
  const encoded = JSON.stringify(snapshot);
  await db.prepare('INSERT INTO content_drafts (id,kind,entity_id,title,snapshot,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, kind, entity, `Pagina ${page}`, encoded, Date.now()).run();
  const saved = await db.prepare('SELECT kind,entity_id,snapshot FROM content_drafts WHERE id=?').bind(id).first<{kind:string;entity_id:string;snapshot:string}>();
  if (!saved || saved.kind !== kind || saved.entity_id !== entity || saved.snapshot !== encoded) throw new AppError(409, 'Identificatorul schiței este deja folosit pentru alte date.');
  return { id };
}
export async function textRecoveryList(db: Database, file: StoredBookFile, page: number, source: string, offset: number) {
  const entity = scope(file, page), selected = table(source);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new AppError(400, 'Pagina listei este nevalidă.');
  const fields = source === 'drafts' ? 'id,created_at' : 'id,revision,event,recorded_at';
  const order = source === 'drafts' ? 'created_at DESC,id DESC' : 'id DESC';
  const rows = (await db.prepare(`SELECT ${fields} FROM ${selected} WHERE kind=? AND entity_id=? ORDER BY ${order} LIMIT 21 OFFSET ?`).bind(kind, entity, offset).all()).results;
  return { entries: rows.slice(0,20), hasMore: rows.length > 20 };
}
export async function textRecoveryItem(db: Database, file: StoredBookFile, page: number, source: string, id: string) {
  const entity = scope(file, page), selected = table(source); identifier(source, id);
  const row = await db.prepare(`SELECT snapshot FROM ${selected} WHERE id=? AND kind=? AND entity_id=?`).bind(id, kind, entity).first<{snapshot:string}>();
  if (!row) throw new AppError(404, 'Versiunea nu mai există pentru această pagină.');
  const snapshot: BookTextSnapshot | null = textSnapshot(JSON.parse(row.snapshot));
  if (!snapshot || snapshot.fileId !== file.id || snapshot.page !== page) throw new AppError(409, 'Versiunea nu corespunde paginii.');
  return { snapshot };
}
export async function deleteTextDraft(db: Database, file: StoredBookFile, page: number, id: string) {
  const entity = scope(file, page); identifier('drafts', id);
  await db.prepare('DELETE FROM content_drafts WHERE id=? AND kind=? AND entity_id=?').bind(id, kind, entity).run();
}
