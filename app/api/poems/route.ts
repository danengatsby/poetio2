import { getPoemDb } from '@/db/binding';
import { createPoem, listPoems, validateId, validateInput } from '@/db/poems';
import { apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireOwner(request);
    return Response.json({ poems: await listPoems(getPoemDb()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSafeMutation(request);
    const data = await readJson(request);
    const input = validateInput(data);
    validateId(data.id);
    return Response.json({ poem: await createPoem(getPoemDb(), data.id, input) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
