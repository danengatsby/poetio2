import { getPoemDb } from '@/db/binding';
import { deletePoem, updatePoem, validateId, validateInput, validateRevision } from '@/db/poems';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { id } = await context.params;
    validateId(id);
    const data = await readJson(request);
    const input = validateInput(data);
    validateRevision(data.revision);
    return Response.json({ poem: await updatePoem(getPoemDb(), id, data.revision, input) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { id } = await context.params;
    validateId(id);
    const data = await readJson(request);
    validateRevision(data?.revision);
    await deletePoem(getPoemDb(), id, data.revision);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
