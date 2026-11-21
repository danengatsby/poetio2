import { getPoemDb } from '@/db/binding';
import { listOrders } from '@/db/shop';
import { apiError, requireOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireOwner(request);
    const search = new URL(request.url).searchParams;
    return Response.json(await listOrders(getPoemDb(), search.get('status'), search.get('offset')), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
