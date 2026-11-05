import { getPoemDb } from '@/db/binding';
import { getBookValidator } from '@/db/book-binding';
import { getBookFile, validBookFileId } from '@/db/book-files';
import { bookValidation } from '@/db/book-validation';
import { AppError, apiError, isOwnerEmail, readJson, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSafeMutation(request);
    const { id } = await params;
    if (!validBookFileId(id)) throw new AppError(404, 'Fișierul PDF nu există.');
    const data = await readJson(request, 1024);
    const file = await getBookFile(getPoemDb(), id);
    if (!file || !isOwnerEmail(file.owner_email)) throw new AppError(404, 'Fișierul PDF nu există.');
    const validation = await bookValidation(file, getBookValidator(), data?.retry === true);
    return Response.json({ validation }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
