import type { Database } from './poems';
import { getBook, validateBookId } from './books';
import { validateComment } from './comments';
import { AppError } from '../lib/access';
import type { ReaderComment } from '../lib/poem-comments';

type BookComment = ReaderComment & { book_id: string };

async function requireBook(db: Database, bookId: string) {
  validateBookId(bookId);
  if (!await getBook(db, bookId)) throw new AppError(404, 'Cartea nu mai este disponibilă.');
}

export async function listBookComments(db: Database, bookId: string, offset = 0) {
  await requireBook(db, bookId);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(400, 'Pagina de comentarii este nevalidă.');
  const rows = (await db.prepare("SELECT id, book_id, name, content, created_at FROM book_comments WHERE book_id = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET ?").bind(bookId, offset).all<BookComment>()).results;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM book_comments WHERE book_id = ? AND status = 'approved'").bind(bookId).first<{ total: number }>();
  return { comments: rows.slice(0, 20), hasMore: rows.length > 20, total: count?.total ?? 0 };
}

export async function createBookComment(db: Database, bookId: string, value: unknown) {
  const input = validateComment(value);
  await requireBook(db, bookId);
  await db.prepare("INSERT INTO book_comments (id, book_id, name, content, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING").bind(input.id, bookId, input.name, input.content, Date.now()).run();
  const comment = await db.prepare("SELECT id, book_id, name, content, created_at FROM book_comments WHERE id = ?").bind(input.id).first<BookComment>();
  if (!comment) throw new Error('Saved comment unavailable');
  if (comment.book_id !== bookId || comment.name !== input.name || comment.content !== input.content) throw new AppError(409, 'Acest comentariu a fost deja trimis cu alt conținut.');
  return comment;
}
