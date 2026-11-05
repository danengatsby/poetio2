import { env } from 'cloudflare:workers';
import { getPoemDb } from '@/db/binding';
import { readableBookFile, bookPageError } from '@/db/book-pages';
import type { BookSearchService } from '@/db/book-search';
import { AppError } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Recheck visibility on every poll/result page, even when the index exists.
    const file = await readableBookFile(getPoemDb(), request, id);
    const search = (env as unknown as { BOOK_SEARCH?: BookSearchService }).BOOK_SEARCH;
    if (!search) throw new AppError(503, 'Căutarea cărții nu este disponibilă momentan.');
    const url = new URL(request.url), rawOffset = url.searchParams.get('offset') ?? '0';
    if (!/^(?:0|[1-9]\d{0,3})$/.test(rawOffset)) throw new AppError(400, 'Pagina rezultatelor este nevalidă.');
    const result = await search.search(file, url.searchParams.get('q') ?? '', Number(rawOffset), url.searchParams.get('retry') === '1');
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return bookPageError(error); }
}
