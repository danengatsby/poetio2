import { getPoemDb } from '@/db/binding';
import { createAboutComment, listAboutComments } from '@/db/about-comments';
import { AppError, apiError, readJson, requireSameOrigin } from '@/lib/access';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  try {
    const offset = Number(new URL(request.url).searchParams.get('offset') ?? 0);
    return Response.json(await listAboutComments(getPoemDb(), offset), { headers });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const input = await readJson(request, 16_384);
    await createAboutComment(getPoemDb(), input);
    return Response.json({ received: true }, { status: 202, headers });
  } catch (error) { return apiError(error); }
}
