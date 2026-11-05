import { getPoemDb } from '@/db/binding';
import { getBookValidator } from '@/db/book-binding';
import { createBook, listBooks } from '@/db/books';
import { apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  try { requireOwner(request); return Response.json({ books: await listBooks(getPoemDb()) }, { headers }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    requireSafeMutation(request);
    const data = await readJson(request);
    return Response.json({ book: await createBook(getPoemDb(), data?.id, data, getBookValidator()) }, { status: 201, headers });
  } catch (error) { return apiError(error); }
}
