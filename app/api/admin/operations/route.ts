import { env } from 'cloudflare:workers';
import { apiError, requireOwner } from '@/lib/access';
import type { OperationsSnapshot } from '@/lib/operations';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    requireOwner(request);
    const binding = (env as unknown as { OPERATIONS?: { snapshot(): Promise<OperationsSnapshot> } }).OPERATIONS;
    return Response.json(binding ? await binding.snapshot() : { available: false }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
