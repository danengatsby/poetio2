export const MAX_BOOK_BYTES = 100 * 1024 * 1024;
export const BOOK_ACCEPT = '.pdf,application/pdf';
export type BookValidation = {
  status: 'checking' | 'ready' | 'error';
  pages: number;
  checkedPages: number;
  error?: string;
};
export type Book = { id: string; title: string; author: string; description: string; file_id: string; image_id: string | null; image_2_id: string | null; purchase_url_1: string | null; purchase_url_2: string | null; revision: number; created_at: number; updated_at: number };
export type BookWithCommentCount = Book & { comment_count: number };
export type BookInput = Pick<Book, 'title' | 'author' | 'description' | 'file_id' | 'image_id' | 'image_2_id' | 'purchase_url_1' | 'purchase_url_2'>;
export const MAX_PURCHASE_URL = 2048;
export function bookPurchaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_PURCHASE_URL || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function bookFileType(file: Pick<File, 'name'>): string | null {
  return file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null;
}
