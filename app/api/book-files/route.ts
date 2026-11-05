import { getPoemDb } from '@/db/binding';
import { getBookBucket, getBookValidator } from '@/db/book-binding';
import { saveBookFile } from '@/db/book-files';
import { apiError, requireSameOriginOwner } from '@/lib/access';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    requireSameOriginOwner(request);
    const file = await saveBookFile(getPoemDb(), getBookBucket(), request, getBookValidator());
    return Response.json({ file: { id: file.id, file_name: file.file_name, url: `/api/book-files/${file.id}` } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
