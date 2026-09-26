import { getPoemDb } from '@/db/binding';
import { listModerationComments } from '@/db/comment-moderation';
import { apiError, requireOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    requireOwner(request);
    const query = new URL(request.url).searchParams;
    const result = await listModerationComments(getPoemDb(), query.get('kind') ?? 'all', query.get('status') ?? 'pending', Number(query.get('offset') ?? 0));
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
