import { getPoemDb } from '@/db/binding';
import { createBookComment, listBookComments } from '@/db/book-comments';
import { AppError, apiError, readJson, requireSameOrigin } from '@/lib/access';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const offset = Number(new URL(request.url).searchParams.get('offset') ?? 0);
    return Response.json(await listBookComments(getPoemDb(), id, offset), { headers });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const { id } = await context.params;
    const input = await readJson(request, 16_384);
    await createBookComment(getPoemDb(), id, input);
    return Response.json({ received: true }, { status: 202, headers });
  } catch (error) { return apiError(error); }
}
