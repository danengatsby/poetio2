import { getPoemDb } from '@/db/binding';
import { listAdminPoems, translationInventory } from '@/db/poem-admin-list';
import { apiError, requireOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  let response: Response;
  try {
    requireOwner(request);
    const db = getPoemDb();
    const params = new URL(request.url).searchParams;
    const collection = await listAdminPoems(db, Object.fromEntries(params));
    response = Response.json(
      params.get('inventory') === '1'
        ? await translationInventory(
            db,
            collection.poems.map(p => p.id),
          )
        : collection,
    );
  } catch (error) {
    response = apiError(error);
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
