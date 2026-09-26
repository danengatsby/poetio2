import { getPoemDb } from '@/db/binding';
import { contentKind, recoveryList, saveDraft } from '@/db/editorial';
import { apiError, readJson, requireOwner, requireSafeMutation } from '@/lib/access';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{kind:string;source:string}> };
const headers = {'Cache-Control':'private, no-store'};
export async function GET(request:Request,{params}:Context) {
  try { requireOwner(request); const {kind,source}=await params;contentKind(kind);return Response.json(await recoveryList(getPoemDb(),kind,source,Number(new URL(request.url).searchParams.get('offset')??0)),{headers}); } catch(error){return apiError(error);}
}
export async function POST(request:Request,{params}:Context) {
  try { requireSafeMutation(request);const {kind,source}=await params;contentKind(kind);if(source!=='drafts')return new Response(null,{status:405,headers});const data=await readJson(request);return Response.json(await saveDraft(getPoemDb(),kind,data?.id,data?.snapshot),{status:201,headers}); } catch(error){return apiError(error);}
}
