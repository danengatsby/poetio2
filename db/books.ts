import { AppError, isOwnerEmail } from '../lib/access';
import { validImageId, requireAvailableImage } from './images';
import { validateRevision, type Database } from './poems';
import { getBookFile } from './book-files';
import type { Book, BookInput, BookWithCommentCount } from '../lib/book-types';

export function validateBookId(id: unknown): asserts id is string {
  if (!validImageId(id)) throw new AppError(400, 'Identificatorul cărții este nevalid.');
}
export function validateBook(value: unknown): BookInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Completează datele cărții.');
  const data = value as Record<string, unknown>;
  const read = (key: string, max: number, label: string, required = false) => {
    if (typeof data[key] !== 'string') throw new AppError(400, `${label}: valoare nevalidă.`);
    const text = data[key].replace(/\r\n?/g, '\n').trim();
    if (required && !text) throw new AppError(400, `Completează câmpul „${label}”.`);
    if (text.length > max) throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return text;
  };
  validateBookId(data.file_id);
  if (data.image_id != null && !validImageId(data.image_id)) throw new AppError(400, 'Coperta selectată este nevalidă.');
  return { title: read('title', 180, 'Titlu', true), author: read('author', 120, 'Autor'), description: read('description', 5000, 'Descriere'), file_id: data.file_id, image_id: (data.image_id as string | null) ?? null };
}
async function requireFile(db: Database, id: string) {
  const file = await getBookFile(db, id);
  if (!file || !isOwnerEmail(file.owner_email)) throw new AppError(400, 'Încarcă fișierul PDF înainte de salvare.');
}
export async function listBooks(db: Database): Promise<BookWithCommentCount[]> {
  return (await db.prepare(`SELECT books.*, (SELECT COUNT(*) FROM book_comments WHERE book_id = books.id AND status = 'approved') AS comment_count
    FROM books ORDER BY created_at DESC, id DESC`).all<BookWithCommentCount>()).results;
}
export function getBook(db: Database, id: string) { return db.prepare('SELECT * FROM books WHERE id = ?').bind(id).first<Book>(); }
const matches = (book: Book, input: BookInput) => book.title === input.title && book.author === input.author && book.description === input.description && book.file_id === input.file_id && book.image_id === input.image_id;

export async function createBook(db: Database, id: string, value: unknown) {
  validateBookId(id);
  const input = validateBook(value);
  await requireFile(db, input.file_id);
  await requireAvailableImage(db, input.image_id);
  const now = Date.now();
  await db.prepare('INSERT INTO books (id, title, author, description, file_id, image_id, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, input.title, input.author, input.description, input.file_id, input.image_id, now, now).run();
  const book = await getBook(db, id);
  if (!book || !matches(book, input)) throw new AppError(409, 'Cartea a fost deja salvată cu alt conținut. Reîncarcă lista.');
  return book;
}
export async function updateBook(db: Database, id: string, revision: number, value: unknown) {
  validateBookId(id); validateRevision(revision);
  const input = validateBook(value);
  await requireFile(db, input.file_id);
  await requireAvailableImage(db, input.image_id);
  const result = await db.prepare('UPDATE books SET title = ?, author = ?, description = ?, file_id = ?, image_id = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?').bind(input.title, input.author, input.description, input.file_id, input.image_id, Date.now(), id, revision).run();
  const book = await getBook(db, id);
  if (!book) throw new AppError(404, 'Cartea a fost ștearsă. Datele introduse rămân în formular.');
  if (!result.meta.changes && !(book.revision === revision + 1 && matches(book, input))) throw new AppError(409, 'Cartea a fost modificată în altă pagină. Copiază datele introduse, apoi reîncarcă lista.');
  return book;
}
export async function deleteBook(db: Database, id: string, revision: number) {
  validateBookId(id); validateRevision(revision);
  const result = await db.prepare('DELETE FROM books WHERE id = ? AND revision = ?').bind(id, revision).run();
  if (!result.meta.changes && await getBook(db, id)) throw new AppError(409, 'Cartea a fost modificată între timp. Reîncarcă lista înainte de ștergere.');
}
