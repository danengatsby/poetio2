import { getPoemDb } from '@/db/binding';
import { contentKind, recoveryItem } from '@/db/editorial';
import { apiError, requireOwner, requireSafeMutation } from '@/lib/access';
import { validImageId } from '@/db/images';
export const dynamic = 'force-dynamic';
type Context = {params:Promise<{kind:string;source:string;id:string}>};
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request,{params}:Context){try{requireOwner(request);const {kind,source,id}=await params;contentKind(kind);return Response.json(await recoveryItem(getPoemDb(),kind,source,id),{headers});}catch(error){return apiError(error);}}
export async function DELETE(request:Request,{params}:Context){try{requireSafeMutation(request);const {kind,source,id}=await params;contentKind(kind);if(source!=='drafts'||!validImageId(id))return new Response(null,{status:400,headers});await getPoemDb().prepare('DELETE FROM content_drafts WHERE id=? AND kind=?').bind(id,kind).run();return Response.json({deleted:true},{headers});}catch(error){return apiError(error);}}
