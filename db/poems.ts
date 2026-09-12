import type { Poem, PoemInput } from '../lib/poem-types';
import { AppError } from '../lib/access';
import { seedPoems } from './seed-poems';
import { requireAvailableImage, validImageId } from './images';
import { languageBackfill } from './language-backfill';
import { requireAvailableAudio, validAudioId } from './audio';
import { AUDIO_FIELDS } from '../lib/poem-audio';

export type Statement = {
  bind(...args: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type Database = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };

export async function ensureInitialPoems(db: Database) {
  const marker = await db.prepare('SELECT value FROM collection_meta WHERE key = ?').bind('initial_poems_v1').first();
  if (marker) return;
  // One atomic batch also protects against concurrent first requests. The marker
  // persists after deleting poems, so deleted examples are never recreated.
  const statements = seedPoems.map(poem => db.prepare(`INSERT INTO poems (id, title, author, theme, content, source_language, revision, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, 'en-US', 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM collection_meta WHERE key = ?)
    ON CONFLICT(id) DO NOTHING`).bind(poem.id, poem.title, poem.author, poem.theme, poem.content, poem.created_at, poem.created_at, 'initial_poems_v1'));
  statements.push(db.prepare('INSERT INTO collection_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').bind('initial_poems_v1', 'complete'));
  await db.batch(statements);
}

export async function ensureLanguageVariants(db: Database) {
  if (await db.prepare('SELECT value FROM collection_meta WHERE key = ?').bind('poem_languages_v1').first()) return;
  const statements = languageBackfill.map(poem => db.prepare(`UPDATE poems
    SET source_language = ?, translated_title = ?, translated_theme = ?, translated_content = ?, revision = revision + 1, updated_at = ?
    WHERE id = ? AND title = ? AND theme = ? AND content = ? AND translated_title IS NULL AND translated_content IS NULL
    AND NOT EXISTS (SELECT 1 FROM collection_meta WHERE key = ?)`)
    .bind(poem.sourceLanguage, poem.title, poem.theme, poem.content, Date.now(), poem.id, poem.expectedTitle, poem.expectedTheme, poem.expectedContent, 'poem_languages_v1'));
  statements.push(db.prepare('INSERT INTO collection_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').bind('poem_languages_v1', 'complete'));
  await db.batch(statements);
}

export async function listPoems(db: Database): Promise<Poem[]> {
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  return (await db.prepare('SELECT * FROM poems ORDER BY created_at ASC, id ASC').all<Poem>()).results;
}

export function validateInput(value: unknown): PoemInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Datele poemului lipsesc.');
  const obj = value as Record<string, unknown>;
  const read = (key: string, label: string, max: number, required: boolean) => {
    if (typeof obj[key] !== 'string') throw new AppError(400, `${label}: valoare nevalidă.`);
    const text = key === 'content' ? obj[key].replace(/\r\n?/g, '\n') : obj[key].trim();
    if (required && !text.trim()) throw new AppError(400, `Completează câmpul „${label}”.`);
    if (text.length > max) throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return text;
  };
  const input: PoemInput = { title: read('title', 'Titlu', 180, true), author: read('author', 'Autor', 120, true), theme: read('theme', 'Temă', 80, false), content: read('content', 'Textul poemului', 30000, true) };
  if (obj.image_id !== undefined) {
    if (obj.image_id !== null && !validImageId(obj.image_id)) throw new AppError(400, 'Imaginea selectată este nevalidă.');
    input.image_id = obj.image_id as string | null;
  }
  for (const field of AUDIO_FIELDS) {
    if (obj[field] === undefined) continue;
    if (obj[field] !== null && !validAudioId(obj[field])) throw new AppError(400, 'Înregistrarea selectată este nevalidă.');
    input[field] = obj[field] as string | null;
  }
  if (obj.source_language !== undefined) {
    if (obj.source_language !== 'ro' && obj.source_language !== 'en-US') throw new AppError(400, 'Alege Română sau English (US) pentru limba originalului.');
    input.source_language = obj.source_language;
  }
  const translatedKeys = ['translated_title', 'translated_theme', 'translated_content'] as const;
  if (translatedKeys.some(key => obj[key] !== undefined)) {
    for (const key of translatedKeys) {
      if (obj[key] !== null && typeof obj[key] !== 'string') throw new AppError(400, 'Completează câmpurile traducerii sau lasă-le goale.');
      const value = typeof obj[key] === 'string' ? (key === 'translated_content' ? obj[key].replace(/\r\n?/g, '\n') : obj[key].trim()) : '';
      const max = key === 'translated_content' ? 30000 : key === 'translated_title' ? 180 : 80;
      if (value.length > max) throw new AppError(400, `Câmpul traducerii depășește limita de ${max} de caractere.`);
      input[key] = value.trim() ? value : null;
    }
    if (Boolean(input.translated_title) !== Boolean(input.translated_content)) throw new AppError(400, 'Completează atât titlul, cât și textul traducerii, sau lasă ambele câmpuri goale.');
    if (!input.translated_content) input.translated_theme = null;
  }
  return input;
}

export function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^(?:original-[1-6]|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(id)) throw new AppError(400, 'Identificatorul poemului este nevalid.');
}

export function validateRevision(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new AppError(400, 'Versiunea poemului este nevalidă.');
}

export async function getPoem(db: Database, id: string) {
  return db.prepare('SELECT * FROM poems WHERE id = ?').bind(id).first<Poem>();
}

export async function createPoem(db: Database, id: string, input: PoemInput) {
  validateId(id);
  if (id.startsWith('original-')) throw new AppError(400, 'Identificator rezervat.');
  await ensureInitialPoems(db);
  await ensureLanguageVariants(db);
  await requireAvailableImage(db, input.image_id);
  for (const field of AUDIO_FIELDS) await requireAvailableAudio(db, input[field]);
  const now = Date.now();
  await db.prepare('INSERT INTO poems (id, title, author, theme, content, source_language, translated_title, translated_theme, translated_content, image_id, audio_ro_id, audio_en_id, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, input.title, input.author, input.theme, input.content, input.source_language ?? 'ro', input.translated_title ?? null, input.translated_theme ?? null, input.translated_content ?? null, input.image_id ?? null, input.audio_ro_id ?? null, input.audio_en_id ?? null, now, now).run();
  const poem = await getPoem(db, id);
  if (!poem) throw new Error('Inserted poem unavailable');
  if (AUDIO_FIELDS.some(field => poem[field] !== (input[field] ?? null)) || poem.title !== input.title || poem.author !== input.author || poem.theme !== input.theme || poem.content !== input.content || poem.image_id !== (input.image_id ?? null) || poem.source_language !== (input.source_language ?? 'ro') || poem.translated_title !== (input.translated_title ?? null) || poem.translated_theme !== (input.translated_theme ?? null) || poem.translated_content !== (input.translated_content ?? null)) throw new AppError(409, 'Acest poem a fost deja salvat cu alt conținut. Reîncarcă lista înainte de a continua.');
  return poem;
}

export async function updatePoem(db: Database, id: string, revision: number, input: PoemInput) {
  validateId(id); validateRevision(revision);
  await ensureLanguageVariants(db);
  await requireAvailableImage(db, input.image_id);
  for (const field of AUDIO_FIELDS) await requireAvailableAudio(db, input[field]);
  const current = await getPoem(db, id);
  if (!current) throw new AppError(404, 'Poemul a fost șters. Poți copia textul și crea un poem nou.');
  const language = input.source_language ?? current.source_language;
  const sourceChanged = input.title !== current.title || input.theme !== current.theme || input.content !== current.content || language !== current.source_language;
  const translationsProvided = input.translated_content !== undefined;
  const translatedTitle = translationsProvided ? input.translated_title ?? null : sourceChanged ? null : current.translated_title;
  const translatedTheme = translationsProvided ? input.translated_theme ?? null : sourceChanged ? null : current.translated_theme;
  const translatedContent = translationsProvided ? input.translated_content ?? null : sourceChanged ? null : current.translated_content;
  const result = await db.prepare('UPDATE poems SET title = ?, author = ?, theme = ?, content = ?, source_language = ?, translated_title = ?, translated_theme = ?, translated_content = ?, image_id = CASE WHEN ? = 1 THEN ? ELSE image_id END, audio_ro_id = CASE WHEN ? = 1 THEN ? ELSE audio_ro_id END, audio_en_id = CASE WHEN ? = 1 THEN ? ELSE audio_en_id END, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?')
    .bind(input.title, input.author, input.theme, input.content, language, translatedTitle, translatedTheme, translatedContent, input.image_id === undefined ? 0 : 1, input.image_id ?? null, input.audio_ro_id === undefined ? 0 : 1, input.audio_ro_id ?? null, input.audio_en_id === undefined ? 0 : 1, input.audio_en_id ?? null, Date.now(), id, revision).run();
  const poem = await getPoem(db, id);
  if (!poem) throw new AppError(404, 'Poemul a fost șters. Poți copia textul și crea un poem nou.');
  if (!result.meta.changes) {
    if (AUDIO_FIELDS.every(field => input[field] === undefined || poem[field] === input[field]) && poem.revision === revision + 1 && poem.title === input.title && poem.author === input.author && poem.theme === input.theme && poem.content === input.content && (input.image_id === undefined || poem.image_id === input.image_id) && poem.source_language === language && poem.translated_title === translatedTitle && poem.translated_theme === translatedTheme && poem.translated_content === translatedContent) return poem;
    throw new AppError(409, 'Poemul a fost modificat în altă pagină. Copiază textul introdus, apoi reîncarcă lista înainte de a edita din nou.');
  }
  return poem;
}

export async function deletePoem(db: Database, id: string, revision: number) {
  validateId(id); validateRevision(revision);
  const result = await db.prepare('DELETE FROM poems WHERE id = ? AND revision = ?').bind(id, revision).run();
  if (!result.meta.changes && await getPoem(db, id)) throw new AppError(409, 'Poemul a fost modificat între timp. Reîncarcă lista și verifică-l înainte de ștergere.');
}
