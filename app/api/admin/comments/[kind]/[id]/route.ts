import { getPoemDb } from '@/db/binding';
import { deleteModeratedComment, moderateComment, validateCommentKind } from '@/db/comment-moderation';
import { apiError, readJson, requireSafeMutation } from '@/lib/access';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ kind: string; id: string }> };
const headers = { 'Cache-Control': 'private, no-store' };

export async function PATCH(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { kind, id } = await context.params;
    validateCommentKind(kind);
    const data = await readJson(request, 4096);
    const comment = await moderateComment(getPoemDb(), kind, id, data?.revision, data?.status);
    return Response.json({ comment }, { headers });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requireSafeMutation(request);
    const { kind, id } = await context.params;
    validateCommentKind(kind);
    const data = await readJson(request, 4096);
    await deleteModeratedComment(getPoemDb(), kind, id, data?.revision);
    return Response.json({ deleted: true }, { headers });
  } catch (error) { return apiError(error); }
}
