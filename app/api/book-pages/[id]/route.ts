import { getPoemDb } from '@/db/binding';
import { readableBookFile, getBookRenderer, bookPageError } from '@/db/book-pages';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const file = await readableBookFile(getPoemDb(), request, (await params).id);
    return Response.json(await getBookRenderer().info(file), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return bookPageError(error); }
}
