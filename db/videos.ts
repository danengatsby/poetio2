import { AppError, isOwnerEmail } from '../lib/access';
import { validImageId } from './images';
import { validateRevision, type Database } from './poems';
import { getVideoFile } from './video-files';
import type { Video, VideoInput, VideoWithCommentCount } from '../lib/video-types';

export function validateVideoId(id: unknown): asserts id is string {
  if (!validImageId(id)) throw new AppError(400, 'Identificatorul video este nevalid.');
}
export function validateVideo(value: unknown): VideoInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Completează datele videoului.');
  const data = value as Record<string, unknown>;
  const read = (key: string, max: number, label: string, required = false) => {
    if (typeof data[key] !== 'string') throw new AppError(400, `${label}: valoare nevalidă.`);
    const text = data[key].replace(/\r\n?/g, '\n').trim();
    if (required && !text) throw new AppError(400, `Completează câmpul „${label}”.`);
    if (text.length > max) throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return text;
  };
  validateVideoId(data.file_id);
  return { title: read('title', 180, 'Titlu', true), author: read('author', 120, 'Autor'), description: read('description', 5000, 'Descriere'), file_id: data.file_id };
}
async function requireFile(db: Database, id: string) {
  const file = await getVideoFile(db, id);
  if (!file || !isOwnerEmail(file.owner_email)) throw new AppError(400, 'Încarcă fișierul video înainte de salvare.');
}
export async function listVideos(db: Database): Promise<VideoWithCommentCount[]> {
  return (await db.prepare(`SELECT videos.*, (SELECT COUNT(*) FROM video_comments WHERE video_id = videos.id AND status = 'approved') AS comment_count
    FROM videos ORDER BY created_at DESC, id DESC`).all<VideoWithCommentCount>()).results;
}
export function getVideo(db: Database, id: string) { return db.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<Video>(); }
const matches = (video: Video, input: VideoInput) => video.title === input.title && video.author === input.author && video.description === input.description && video.file_id === input.file_id;

export async function createVideo(db: Database, id: string, value: unknown) {
  validateVideoId(id);
  const input = validateVideo(value);
  await requireFile(db, input.file_id);
  const now = Date.now();
  await db.prepare('INSERT INTO videos (id, title, author, description, file_id, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, input.title, input.author, input.description, input.file_id, now, now).run();
  const video = await getVideo(db, id);
  if (!video || !matches(video, input)) throw new AppError(409, 'Videoul a fost deja salvat cu alt conținut. Reîncarcă lista.');
  return video;
}
export async function updateVideo(db: Database, id: string, revision: number, value: unknown) {
  validateVideoId(id); validateRevision(revision);
  const input = validateVideo(value);
  await requireFile(db, input.file_id);
  const result = await db.prepare('UPDATE videos SET title = ?, author = ?, description = ?, file_id = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(input.title, input.author, input.description, input.file_id, Date.now(), id, revision).run();
  const video = await getVideo(db, id);
  if (!video) throw new AppError(404, 'Videoul a fost șters. Datele introduse rămân în formular.');
  if (!result.meta.changes && !(video.revision === revision + 1 && matches(video, input))) throw new AppError(409, 'Videoul a fost modificat în altă pagină. Copiază datele introduse, apoi reîncarcă lista.');
  return video;
}
export async function deleteVideo(db: Database, id: string, revision: number) {
  validateVideoId(id); validateRevision(revision);
  const result = await db.prepare('DELETE FROM videos WHERE id = ? AND revision = ?').bind(id, revision).run();
  if (!result.meta.changes && await getVideo(db, id)) throw new AppError(409, 'Videoul a fost modificat între timp. Reîncarcă lista înainte de ștergere.');
}
