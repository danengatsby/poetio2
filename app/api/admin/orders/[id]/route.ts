import { getPoemDb } from '@/db/binding';
import { updateOrderStatus } from '@/db/shop';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSafeMutation(request);
    const order = await updateOrderStatus(getPoemDb(), (await params).id, await readJson(request, 4_096));
    return Response.json({ order }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
