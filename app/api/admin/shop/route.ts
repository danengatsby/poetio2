import { getPoemDb } from '@/db/binding';
import { getShopSettings, listShopBooks, saveShopSettings } from '@/db/shop';
import { apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';
import { publicShop } from '@/lib/shop';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  try {
    requireOwner(request);
    const db = getPoemDb();
    return Response.json({ shop: publicShop(await getShopSettings(db)), books: await listShopBooks(db) }, { headers });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    requireSafeMutation(request);
    const settings = await saveShopSettings(getPoemDb(), await readJson(request, 16_384));
    return Response.json({ shop: publicShop(settings) }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
