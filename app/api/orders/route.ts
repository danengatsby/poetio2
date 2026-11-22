import { getPoemDb } from '@/db/binding';
import { clientIp } from '@/db/client-ip';
import { createOrder } from '@/db/shop';
import { AppError, apiError, readJson, requireSameOrigin } from '@/lib/access';
import { createRateLimit } from '@/lib/rate-limit';
import { ORDER_LIMITS } from '@/lib/shop';

export const dynamic = 'force-dynamic';

const perAddress = createRateLimit(ORDER_LIMITS.perAddressPerHour, 3_600_000);

// Places an order for books sold on Poetio. nginx limits how often one visitor may call it;
// here one IP address may place a few orders an hour, and db/shop.ts limits the rest.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const ip = clientIp(request);
    if (!perAddress.allows(ip))
      throw new AppError(
        429,
        'De la această conexiune s-au trimis deja mai multe comenzi. Încearcă din nou peste o oră.',
      );
    const order = await createOrder(getPoemDb(), await readJson(request, 16_384));
    perAddress.record(ip);
    return Response.json({ order }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
