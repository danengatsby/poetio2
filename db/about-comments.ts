import type { Database } from './poems';
import { validateComment } from './comments';
import { AppError } from '../lib/access';
import type { ReaderComment } from '../lib/poem-comments';

export async function listAboutComments(db: Database, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(400, 'Pagina de comentarii este nevalidă.');
  const rows = (await db.prepare("SELECT id, name, content, created_at FROM about_comments WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET ?").bind(offset).all<ReaderComment>()).results;
  return { comments: rows.slice(0, 20), hasMore: rows.length > 20 };
}

export async function createAboutComment(db: Database, value: unknown) {
  const input = validateComment(value);
  await db.prepare("INSERT INTO about_comments (id, name, content, created_at, status) VALUES (?, ?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING").bind(input.id, input.name, input.content, Date.now()).run();
  const comment = await db.prepare("SELECT id, name, content, created_at FROM about_comments WHERE id = ?").bind(input.id).first<ReaderComment>();
  if (!comment) throw new Error('Saved comment unavailable');
  if (comment.name !== input.name || comment.content !== input.content) throw new AppError(409, 'Acest comentariu a fost deja trimis cu alt conținut.');
  return comment;
}
