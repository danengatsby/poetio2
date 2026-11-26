import { isSiteLanguage } from '../lib/site-language';
import { AppError, isOwnerEmail } from '../lib/access';
import { validImageId } from './images';
import { validateRevision, type Database } from './poems';
import { getVideoFile } from './video-files';
import type { Video, VideoInput, VideoWithCommentCount } from '../lib/video-types';
import { requireReadyMedia, type MediaValidator } from './media-validation';

export function validateVideoId(id: unknown): asserts id is string {
  if (!validImageId(id)) throw new AppError(400, 'Identificatorul video este nevalid.');
}
export function validateVideo(value: unknown): VideoInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AppError(400, 'Completează datele videoului.');
  const data = value as Record<string, unknown>;
  const read = (key: string, max: number, label: string, required = false) => {
    if (typeof data[key] !== 'string') throw new AppError(400, `${label}: valoare nevalidă.`);
    const text = data[key].replace(/\r\n?/g, '\n').trim();
    if (required && !text) throw new AppError(400, `Completează câmpul „${label}”.`);
    if (text.length > max) throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return text;
  };
  validateVideoId(data.file_id);
  const subtitle_text = data.subtitle_text == null ? '' : read('subtitle_text', 60000, 'Subtitrare');
  const subtitle_language = data.subtitle_language ?? 'ro';
  if (!isSiteLanguage(subtitle_language)) throw new AppError(400, 'Limba subtitrării este nevalidă.');
  if (subtitle_text) validateCues(subtitle_text);
  return {
    subtitle_text,
    subtitle_language,
    title: read('title', 180, 'Titlu', true),
    author: read('author', 120, 'Autor'),
    description: read('description', 5000, 'Descriere'),
    file_id: data.file_id,
  };
}
function validateCues(text: string) {
  const [header, ...blocks] = text.split(/\n[ \t]*\n/);
  if (!/^WEBVTT(?:[ \t][^\n]*)?$/.test(header) || !blocks.length)
    throw new AppError(400, 'Subtitrarea trebuie să înceapă cu WEBVTT și să conțină replici sincronizate.');
  const time = (s: string) => s.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  let seen = 0;
  for (const block of blocks) {
    if (/^NOTE(?:\s|$)/.test(block) || /^(STYLE|REGION)\n/.test(block)) continue;
    const lines = block.split('\n');
    const index = lines[0].includes('-->') ? 0 : 1;
    const timing =
      /^((?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3})[ \t]+-->[ \t]+((?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3})(?:[ \t].*)?$/.exec(
        lines[index] || '',
      );
    if (
      !timing ||
      time(timing[2]) <= time(timing[1]) ||
      !lines
        .slice(index + 1)
        .join('')
        .trim()
    )
      throw new AppError(400, 'Verifică începutul, sfârșitul și textul fiecărei replici WebVTT.');
    seen++;
  }
  if (!seen) throw new AppError(400, 'Lipsește textul sincronizat.');
}
async function requireFile(db: Database, id: string, validator?: MediaValidator) {
  const file = await getVideoFile(db, id);
  if (!file || !isOwnerEmail(file.owner_email)) throw new AppError(400, 'Încarcă fișierul video înainte de salvare.');
  await requireReadyMedia(file, 'video', validator);
}
export async function listVideos(db: Database, includeText = true): Promise<VideoWithCommentCount[]> {
  return (
    await db
      .prepare(
        `SELECT id,title,author,description,file_id,revision,created_at,updated_at,subtitle_language,
    length(subtitle_text)>0 AS has_subtitles, ${includeText ? 'subtitle_text' : "'' AS subtitle_text"}, (SELECT COUNT(*) FROM video_comments WHERE video_id = videos.id AND status = 'approved') AS comment_count
    FROM videos ORDER BY created_at DESC, id DESC`,
      )
      .all<VideoWithCommentCount>()
  ).results;
}
export function getVideo(db: Database, id: string) {
  return db.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<Video>();
}
const matches = (video: Video, input: VideoInput) =>
  video.title === input.title &&
  video.author === input.author &&
  video.description === input.description &&
  video.file_id === input.file_id &&
  video.subtitle_text === input.subtitle_text &&
  video.subtitle_language === input.subtitle_language;

export async function createVideo(db: Database, id: string, value: unknown, validator?: MediaValidator) {
  validateVideoId(id);
  const input = validateVideo(value);
  await requireFile(db, input.file_id, validator);
  const now = Date.now();
  await db
    .prepare(
      'INSERT INTO videos (id, title, author, description, file_id, subtitle_text, subtitle_language, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING',
    )
    .bind(
      id,
      input.title,
      input.author,
      input.description,
      input.file_id,
      input.subtitle_text,
      input.subtitle_language,
      now,
      now,
    )
    .run();
  const video = await getVideo(db, id);
  if (!video || !matches(video, input))
    throw new AppError(409, 'Videoul a fost deja salvat cu alt conținut. Reîncarcă lista.');
  return video;
}
export async function updateVideo(
  db: Database,
  id: string,
  revision: number,
  value: unknown,
  validator?: MediaValidator,
) {
  validateVideoId(id);
  validateRevision(revision);
  const previous = await getVideo(db, id);
  const input = validateVideo(
    value && typeof value === 'object'
      ? { subtitle_text: previous?.subtitle_text, subtitle_language: previous?.subtitle_language, ...value }
      : value,
  );
  await requireFile(db, input.file_id, validator);
  const result = await db
    .prepare(
      'UPDATE videos SET title = ?, author = ?, description = ?, file_id = ?, subtitle_text=?, subtitle_language=?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?',
    )
    .bind(
      input.title,
      input.author,
      input.description,
      input.file_id,
      input.subtitle_text,
      input.subtitle_language,
      Date.now(),
      id,
      revision,
    )
    .run();
  const video = await getVideo(db, id);
  if (!video) throw new AppError(404, 'Videoul a fost șters. Datele introduse rămân în formular.');
  if (!result.meta.changes && !(video.revision === revision + 1 && matches(video, input)))
    throw new AppError(409, 'Videoul a fost modificat în altă pagină. Copiază datele introduse, apoi reîncarcă lista.');
  return video;
}
export async function deleteVideo(db: Database, id: string, revision: number) {
  validateVideoId(id);
  validateRevision(revision);
  const result = await db.prepare('DELETE FROM videos WHERE id = ? AND revision = ?').bind(id, revision).run();
  if (!result.meta.changes && (await getVideo(db, id)))
    throw new AppError(409, 'Videoul a fost modificat între timp. Reîncarcă lista înainte de ștergere.');
}
