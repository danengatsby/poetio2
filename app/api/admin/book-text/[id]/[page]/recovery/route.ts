import { getPoemDb } from '@/db/binding';
import { getBookTextRenderer } from '@/db/book-binding';
import { readableBookFile, bookPageError } from '@/db/book-pages';
import { textPageNumber } from '@/db/book-text';
import { deleteTextDraft, saveTextDraft, textRecoveryItem, textRecoveryList } from '@/db/book-text-recovery';
import { readJson, requireOwner, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; page: string }> };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request, { params }: Context) {
  try {
    requireOwner(request);
    const { id, page } = await params, db = getPoemDb(), file = await readableBookFile(db, request, id), number = textPageNumber(page);
    const query = new URL(request.url).searchParams, source = query.get('source') || 'drafts', item = query.get('id');
    return reply(item ? await textRecoveryItem(db, file, number, source, item) : await textRecoveryList(db, file, number, source, Number(query.get('offset') || 0)));
  } catch (error) { return bookPageError(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    requireSafeMutation(request);
    const { id, page } = await params, db = getPoemDb(), file = await readableBookFile(db, request, id);
    const input = await readJson(request, 400000) as { id?: unknown; snapshot?: unknown } | null;
    return reply(await saveTextDraft(db, file, textPageNumber(page), input?.id, input?.snapshot, getBookTextRenderer()), 201);
  } catch (error) { return bookPageError(error); }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    requireSafeMutation(request);
    const { id, page } = await params, db = getPoemDb(), file = await readableBookFile(db, request, id);
    await deleteTextDraft(db, file, textPageNumber(page), new URL(request.url).searchParams.get('id') || '');
    return reply({ deleted: true });
  } catch (error) { return bookPageError(error); }
}
