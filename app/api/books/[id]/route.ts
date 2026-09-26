import { getPoemDb } from '@/db/binding';
import { updateBook, deleteBook } from '@/db/books';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'no-store' };
export async function PUT(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { id } = await context.params;
    const data = await readJson(request);
    return Response.json({ book: await updateBook(getPoemDb(), id, data?.revision, data) }, { headers });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { id } = await context.params;
    const data = await readJson(request);
    await deleteBook(getPoemDb(), id, data?.revision);
    return Response.json({ deleted: true }, { headers });
  } catch (error) { return apiError(error); }
}
