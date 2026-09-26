import type { Database } from './poems';
import { getVideo, validateVideoId } from './videos';
import { validateComment } from './comments';
import { AppError } from '../lib/access';
import type { ReaderComment } from '../lib/poem-comments';

type VideoComment = ReaderComment & { video_id: string };

async function requireVideo(db: Database, videoId: string) {
  validateVideoId(videoId);
  if (!await getVideo(db, videoId)) throw new AppError(404, 'Videoul nu mai este disponibil.');
}

export async function listVideoComments(db: Database, videoId: string, offset = 0) {
  await requireVideo(db, videoId);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new AppError(400, 'Pagina de comentarii este nevalidă.');
  const rows = (await db.prepare("SELECT id, video_id, name, content, created_at FROM video_comments WHERE video_id = ? AND status = 'approved' ORDER BY created_at DESC, id DESC LIMIT 21 OFFSET ?").bind(videoId, offset).all<VideoComment>()).results;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM video_comments WHERE video_id = ? AND status = 'approved'").bind(videoId).first<{ total: number }>();
  return { comments: rows.slice(0, 20), hasMore: rows.length > 20, total: count?.total ?? 0 };
}

export async function createVideoComment(db: Database, videoId: string, value: unknown) {
  const input = validateComment(value);
  await requireVideo(db, videoId);
  await db.prepare("INSERT INTO video_comments (id, video_id, name, content, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(id) DO NOTHING").bind(input.id, videoId, input.name, input.content, Date.now()).run();
  const comment = await db.prepare("SELECT id, video_id, name, content, created_at FROM video_comments WHERE id = ?").bind(input.id).first<VideoComment>();
  if (!comment) throw new Error('Saved comment unavailable');
  if (comment.video_id !== videoId || comment.name !== input.name || comment.content !== input.content) throw new AppError(409, 'Acest comentariu a fost deja trimis cu alt conținut.');
  return comment;
}
