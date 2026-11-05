import { getPoemDb } from '@/db/binding';
import { getBookTextRenderer } from '@/db/book-binding';
import { readableBookFile, bookPageError } from '@/db/book-pages';
import { readBookText, textPageNumber } from '@/db/book-text';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; page: string }> }) {
  try {
    const { id, page } = await params;
    const db = getPoemDb();
    const file = await readableBookFile(db, request, id);
    const result = await readBookText(db, file, textPageNumber(page), getBookTextRenderer());
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return bookPageError(error); }
}
