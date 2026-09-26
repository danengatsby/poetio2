import { AppError } from '../lib/access';
import { COMMENT_KINDS, COMMENT_STATUSES, type CommentKind, type CommentStatus, type ModeratedComment, type ModerationPage } from '../lib/comment-moderation';
import { validImageId } from './images';
import { validateRevision, type Database } from './poems';

// Identifiers come exclusively from this fixed map; request values are bound.
const tables = { poem: 'poem_comments', video: 'video_comments', book: 'book_comments', about: 'about_comments' } as const;
const union = `
SELECT c.id, c.name, c.content, c.created_at, c.status, c.revision, c.moderated_at,
 'poem' AS kind, c.poem_id AS parent_id, p.title FROM poem_comments c JOIN poems p ON p.id = c.poem_id
UNION ALL
SELECT c.id, c.name, c.content, c.created_at, c.status, c.revision, c.moderated_at,
 'video', c.video_id, v.title FROM video_comments c JOIN videos v ON v.id = c.video_id
UNION ALL
SELECT c.id, c.name, c.content, c.created_at, c.status, c.revision, c.moderated_at,
 'book', c.book_id, b.title FROM book_comments c JOIN books b ON b.id = c.book_id
UNION ALL
SELECT id, name, content, created_at, status, revision, moderated_at,
 'about', NULL, 'Despre Poetio' FROM about_comments`;

export function validateCommentKind(value: unknown): asserts value is CommentKind {
  if (!COMMENT_KINDS.includes(value as CommentKind)) throw new AppError(400, 'Tipul comentariului este nevalid.');
}
export function validateCommentStatus(value: unknown): asserts value is CommentStatus {
  if (!COMMENT_STATUSES.includes(value as CommentStatus)) throw new AppError(400, 'Starea comentariului este nevalidă.');
}
function validateTarget(kind: unknown, id: unknown, revision: unknown) {
  validateCommentKind(kind);
  if (!validImageId(id)) throw new AppError(400, 'Identificatorul comentariului este nevalid.');
  validateRevision(revision);
  return tables[kind];
}

export async function listModerationComments(db: Database, kind = 'all', status = 'pending', offset = 0): Promise<ModerationPage> {
  if (kind !== 'all') validateCommentKind(kind);
  if (status !== 'all') validateCommentStatus(status);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new AppError(400, 'Pagina de comentarii este nevalidă.');
  const filter = "(? = 'all' OR kind = ?)";
  const totals = (await db.prepare(`SELECT status, COUNT(*) AS total FROM (${union}) WHERE ${filter} GROUP BY status`).bind(kind, kind).all<{ status: CommentStatus; total: number }>()).results;
  const counts = { pending: 0, approved: 0, hidden: 0 };
  for (const row of totals) counts[row.status] = row.total;
  const rows = (await db.prepare(`SELECT * FROM (${union}) WHERE ${filter} AND (? = 'all' OR status = ?)
    ORDER BY created_at DESC, id DESC, kind ASC LIMIT 21 OFFSET ?`).bind(kind, kind, status, status, offset).all<ModeratedComment>()).results;
  return { comments: rows.slice(0, 20), hasMore: rows.length > 20, counts,
    total: status === 'all' ? counts.pending + counts.approved + counts.hidden : counts[status as CommentStatus] };
}

export async function moderateComment(db: Database, kind: CommentKind, id: string, revision: number, status: CommentStatus) {
  const table = validateTarget(kind, id, revision);
  validateCommentStatus(status);
  const result = await db.prepare(`UPDATE ${table} SET status = ?, revision = revision + 1, moderated_at = ? WHERE id = ? AND revision = ?`)
    .bind(status, Date.now(), id, revision).run();
  const saved = await db.prepare(`SELECT status, revision FROM ${table} WHERE id = ?`).bind(id).first<{ status: CommentStatus; revision: number }>();
  if (!saved) throw new AppError(404, 'Comentariul nu mai există. Reîncarcă lista.');
  // A lost successful response can safely be retried, without changing a newer decision.
  if (!result.meta.changes && !(saved.revision === revision + 1 && saved.status === status)) throw new AppError(409, 'Comentariul a fost moderat între timp. Reîncarcă lista înainte de a decide din nou.');
  return saved;
}

export async function deleteModeratedComment(db: Database, kind: CommentKind, id: string, revision: number) {
  const table = validateTarget(kind, id, revision);
  const result = await db.prepare(`DELETE FROM ${table} WHERE id = ? AND revision = ?`).bind(id, revision).run();
  if (!result.meta.changes && await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first()) {
    throw new AppError(409, 'Comentariul a fost moderat între timp. Reîncarcă lista înainte de ștergere.');
  }
}
