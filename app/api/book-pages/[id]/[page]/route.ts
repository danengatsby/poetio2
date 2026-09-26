import { getPoemDb } from '@/db/binding';
import { readableBookFile, getBookRenderer, bookPageError } from '@/db/book-pages';
import { AppError } from '@/lib/access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string; page: string }> }) {
  try {
    const { id, page } = await params;
    if (!/^[1-9][0-9]{0,5}$/.test(page)) throw new AppError(404, 'Pagina nu există.');
    const file = await readableBookFile(getPoemDb(), request, id);
    const bytes = await getBookRenderer().page(file, Number(page));
    if (!bytes) throw new AppError(404, 'Pagina nu există.');
    return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return bookPageError(error); }
}
