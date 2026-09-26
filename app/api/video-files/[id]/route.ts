import { getPoemDb } from '@/db/binding';
import { getVideoBucket } from '@/db/video-binding';
import { serveVideoFile } from '@/db/video-files';
import { apiError } from '@/lib/access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await serveVideoFile(getPoemDb(), getVideoBucket(), request, (await params).id); }
  catch (error) { return apiError(error); }
}
export const HEAD = GET;
