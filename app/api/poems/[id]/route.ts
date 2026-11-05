import { getMediaValidator } from '@/db/media-binding';
import { getPoemDb } from '@/db/binding';
import { deletePoem, getPoem, updatePoem, validateId, validateInput, validateRevision } from '@/db/poems';
import { AppError, apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  let response: Response;
  try {
    requireOwner(request);
    const { id } = await context.params;
    validateId(id);
    const poem = await getPoem(getPoemDb(), id);
    if (!poem) throw new AppError(404, 'Poemul nu mai există. Textul din editor rămâne disponibil.');
    response = Response.json({ poem });
  } catch (error) { response = apiError(error); }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function PUT(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { id } = await context.params;
    validateId(id);
    const data = await readJson(request);
    const input = validateInput(data);
    validateRevision(data.revision);
    return Response.json({ poem: await updatePoem(getPoemDb(), id, data.revision, input, getMediaValidator()) }, { headers: { 'Cache-Control': 'no-store' } });
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
