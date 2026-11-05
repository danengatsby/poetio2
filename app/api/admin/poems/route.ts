import { getPoemDb } from '@/db/binding';
import { listAdminPoems } from '@/db/poem-admin-list';
import { apiError, requireOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  let response: Response;
  try {
    requireOwner(request);
    response = Response.json(await listAdminPoems(getPoemDb(), Object.fromEntries(new URL(request.url).searchParams)));
  } catch (error) { response = apiError(error); }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
