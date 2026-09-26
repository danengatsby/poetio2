import { AppError } from '../lib/access';
import { validImageId } from './images';
import { validateId, validateRevision, type Database } from './poems';
import type { ContentKind, EditorSnapshot } from '../lib/editorial';
export function contentKind(value: unknown): asserts value is ContentKind {
  if (value !== 'poem' && value !== 'video') throw new AppError(400, 'Categoria este nevalidă.');
}
export function draftSnapshot(kind: ContentKind, value: unknown): EditorSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Schița lipsește.');
  const data = value as Record<string, unknown>; validateId(data.id); validateRevision(data.revision);
  if (kind === 'video' && !validImageId(data.id)) throw new AppError(400, 'Identificator video nevalid.');
  if (typeof data.isNew !== 'boolean') throw new AppError(400, 'Starea schiței este nevalidă.');
  const result: EditorSnapshot = { id: data.id, title: '', revision: data.revision, isNew: data.isNew };
  const limits = kind === 'poem' ? { title: 180, author: 120, theme: 80, content: 30000, translated_title: 180, translated_theme: 80, translated_content: 30000 } : { title: 180, author: 120, description: 5000 };
  for (const [key, limit] of Object.entries(limits)) {
    if (data[key] !== undefined && data[key] !== null && (typeof data[key] !== 'string' || data[key].length > limit)) throw new AppError(400, 'Un câmp al schiței depășește limita sau este nevalid.');
    result[key] = data[key] ?? '';
  }
  for (const field of kind === 'poem' ? ['image_id','audio_ro_id','audio_en_id'] : ['file_id']) {
    if (data[field] && !validImageId(data[field])) throw new AppError(400, 'Fișierul schiței este nevalid.');
    result[field] = data[field] || (kind === 'video' ? '' : null);
  }
  if (kind === 'poem') { if (data.source_language !== 'ro' && data.source_language !== 'en-US') throw new AppError(400, 'Limba schiței este nevalidă.'); result.source_language = data.source_language; }
  result.pendingFiles = data.pendingFiles === true;
  return result;
}
export async function saveDraft(db: Database, kind: ContentKind, id: unknown, value: unknown) {
  if (!validImageId(id)) throw new AppError(400, 'Identificator de schiță nevalid.');
  const data = draftSnapshot(kind, value), snapshot = JSON.stringify(data);
  await db.prepare('INSERT INTO content_drafts (id, kind, entity_id, title, snapshot, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, kind, data.id, data.title, snapshot, Date.now()).run();
  const saved = await db.prepare('SELECT kind, snapshot FROM content_drafts WHERE id=?').bind(id).first<{ kind: string; snapshot: string }>();
  if (!saved || saved.kind !== kind || saved.snapshot !== snapshot) throw new AppError(409, 'Această schiță a fost salvată cu alte date. Reîncarcă lista.');
  return { id };
}
export async function recoveryList(db: Database, kind: ContentKind, source: string, offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new AppError(400, 'Pagina este nevalidă.');
  if (source !== 'drafts' && source !== 'history') throw new AppError(400, 'Lista este nevalidă.');
  const sql = source === 'drafts' ? 'SELECT id, entity_id, title, created_at FROM content_drafts WHERE kind=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?' : 'SELECT id, entity_id, title, revision, event, recorded_at FROM content_history WHERE kind=? ORDER BY id DESC LIMIT 21 OFFSET ?';
  const rows = (await db.prepare(sql).bind(kind,offset).all()).results;
  return { entries: rows.slice(0,20), hasMore: rows.length > 20 };
}
export async function recoveryItem(db: Database, kind: ContentKind, source: string, id: string) {
  if (source !== 'drafts' && source !== 'history') throw new AppError(400, 'Lista este nevalidă.');
  if (source === 'drafts' ? !validImageId(id) : !/^[1-9][0-9]{0,14}$/.test(id)) throw new AppError(400, 'Identificator nevalid.');
  const table = source === 'drafts' ? 'content_drafts' : 'content_history';
  const row = await db.prepare(`SELECT snapshot, entity_id FROM ${table} WHERE id=? AND kind=?`).bind(id,kind).first<{ snapshot: string; entity_id: string }>();
  if (!row) throw new AppError(404, 'Versiunea nu mai există.');
  const current = await db.prepare(`SELECT revision FROM ${kind === 'poem' ? 'poems' : 'videos'} WHERE id=?`).bind(row.entity_id).first<{revision:number}>();
  return { snapshot: { ...JSON.parse(row.snapshot), id: !current && row.entity_id.startsWith('original-') ? crypto.randomUUID() : row.entity_id, revision: current?.revision ?? 1, isNew: !current } as EditorSnapshot };
}
