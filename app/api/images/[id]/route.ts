import { env } from 'cloudflare:workers';
import { getPoemDb } from '@/db/binding';
import { getImageBucket } from '@/db/image-binding';
import { serveImage, type ImageRenderer } from '@/db/image-serving';
import { apiError } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const renderer = (env as unknown as { IMAGE_RENDERER?: ImageRenderer }).IMAGE_RENDERER;
    return await serveImage(getPoemDb(), getImageBucket(), renderer, request, id);
  } catch (error) { return apiError(error); }
}
export const HEAD = GET;
