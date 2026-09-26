import { getPoemDb } from '@/db/binding';
import { getBookBucket } from '@/db/book-binding';
import { serveBookFile } from '@/db/book-files';
import { apiError } from '@/lib/access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await serveBookFile(getPoemDb(), getBookBucket(), request, (await params).id); }
  catch (error) { return apiError(error); }
}
export const HEAD = GET;
