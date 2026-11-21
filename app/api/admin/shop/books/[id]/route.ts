import { getPoemDb } from '@/db/binding';
import { saveBookShop } from '@/db/shop';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSafeMutation(request);
    const saved = await saveBookShop(getPoemDb(), (await params).id, await readJson(request, 4_096));
    return Response.json({ book: saved }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
