import { getPoemDb } from '@/db/binding';
import { getShopSettings, quote } from '@/db/shop';
import { AppError, apiError, readJson, requireSameOrigin } from '@/lib/access';
import { publicShop } from '@/lib/shop';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

// The cart's current prices, stock and delivery; prices from the browser are ignored.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const data = await readJson(request, 8_192);
    const db = getPoemDb();
    const settings = await getShopSettings(db);
    return Response.json({ quote: await quote(db, data?.items, settings), shop: publicShop(settings) }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
