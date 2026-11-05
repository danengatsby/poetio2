import { getPoemDb } from '@/db/binding';
import { getBookTextRenderer } from '@/db/book-binding';
import { readableBookFile, bookPageError } from '@/db/book-pages';
import { readBookText, saveBookText, textPageNumber } from '@/db/book-text';
import { requireOwner, requireSafeMutation, readJson } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; page: string }> }) {
  try {
    requireOwner(request);
    const { id, page } = await params;
    const db = getPoemDb();
    const file = await readableBookFile(db, request, id);
    const query = new URL(request.url).searchParams;
    return Response.json(await readBookText(db, file, textPageNumber(page), getBookTextRenderer(), query.get('ocr') === '1', query.get('manual') === '1'), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return bookPageError(error); }
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; page: string }> }) {
  try {
    requireSafeMutation(request);
    const { id, page } = await params;
    const db = getPoemDb();
    const file = await readableBookFile(db, request, id);
    return Response.json(await saveBookText(db, file, textPageNumber(page), await readJson(request, 400000), getBookTextRenderer()), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return bookPageError(error); }
}
