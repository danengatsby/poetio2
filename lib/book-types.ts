export const MAX_BOOK_BYTES = 100 * 1024 * 1024;
export const BOOK_ACCEPT = '.pdf,application/pdf';
export type BookValidation = {
  status: 'checking' | 'ready' | 'error';
  pages: number;
  checkedPages: number;
  error?: string;
};
export type Book = { id: string; title: string; author: string; description: string; file_id: string; image_id: string | null; revision: number; created_at: number; updated_at: number };
export type BookWithCommentCount = Book & { comment_count: number };
export type BookInput = Pick<Book, 'title' | 'author' | 'description' | 'file_id' | 'image_id'>;
export function bookFileType(file: Pick<File, 'name'>): string | null {
  return file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null;
}
