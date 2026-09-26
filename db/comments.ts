import type { Database } from './poems';
import { getPoem, validateId } from './poems';
import { AppError } from '../lib/access';
import { COMMENT_NAME_LIMIT, COMMENT_BODY_LIMIT, type PoemComment } from '../lib/poem-comments';

export function validateComment(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Completează numele și comentariul.');
  const data = value as Record<string, unknown>;
  if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) throw new AppError(400, 'Identificatorul comentariului este nevalid.');
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > COMMENT_NAME_LIMIT) throw new AppError(400, `Completează numele (maximum ${COMMENT_NAME_LIMIT} de caractere).`);
  if (typeof data.content !== 'string') throw new AppError(400, 'Completează comentariul.');
  const content = data.content.replace(/\r\n?/g, '\n').trim();
  if (!content || content.length > COMMENT_BODY_LIMIT) throw new AppError(400, `Completează comentariul (maximum ${COMMENT_BODY_LIMIT} de caractere).`);
  return { id: data.id.toLowerCase(), name: data.name.trim(), content };
}

async function requirePoem(db: Database, poemId: string) {
  validateId(poemId);
  if (!await getPoem(db, poemId)) throw new AppError(404, 'Poemul nu mai este disponibil.');
}

export async function listComments(db: Database, poemId: string, offset = 0) {
  await requirePoem(db, poemId);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(400, 'Pagina de comentarii este nevalidă.');
  const rows = (await db.prepare("SELECT id, poem_id, name, content, created_at FROM poem_comments WHERE poem_id = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET ?").bind(poemId, offset).all<PoemComment>()).results;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM poem_comments WHERE poem_id = ? AND status = 'approved'").bind(poemId).first<{ total: number }>();
  return { comments: rows.slice(0, 20), hasMore: rows.length > 20, total: count?.total ?? 0 };
}

export async function createComment(db: Database, poemId: string, value: unknown) {
  const input = validateComment(value);
  await requirePoem(db, poemId);
  await db.prepare("INSERT INTO poem_comments (id, poem_id, name, content, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING").bind(input.id, poemId, input.name, input.content, Date.now()).run();
  const comment = await db.prepare("SELECT id, poem_id, name, content, created_at FROM poem_comments WHERE id = ?").bind(input.id).first<PoemComment>();
  if (!comment) throw new Error('Saved comment unavailable');
  if (comment.poem_id !== poemId || comment.name !== input.name || comment.content !== input.content) throw new AppError(409, 'Acest comentariu a fost deja trimis cu alt conținut.');
  return comment;
}
