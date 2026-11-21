import { getPoemDb } from '@/db/binding';
import { getGeoLocator } from '@/db/geo-binding';
import { visitStats } from '@/db/visits';
import { apiError, requireOwner } from '@/lib/access';
import { visitRange } from '@/lib/visits';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireOwner(request);
    const search = new URL(request.url).searchParams;
    const stats = await visitStats(getPoemDb(), {
      days: visitRange(search.get('zile')),
      ip: search.get('ip') || null,
      offset: Number(search.get('offset')) || 0,
    });
    return Response.json(
      { ...stats, geo: getGeoLocator()?.info() ?? null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
