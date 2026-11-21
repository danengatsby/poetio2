import { getPoemDb } from '@/db/binding';
import { createOrder } from '@/db/shop';
import { AppError, apiError, readJson, requireSameOrigin } from '@/lib/access';

export const dynamic = 'force-dynamic';

// Places an order for books sold on Poetio. nginx limits how often one visitor may call it.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const order = await createOrder(getPoemDb(), await readJson(request, 16_384));
    return Response.json({ order }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
