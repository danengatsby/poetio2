import { getPoemDb } from '@/db/binding';
import { getAudioBucket } from '@/db/audio-binding';
import { serveAudio } from '@/db/audio';
import { apiError } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return await serveAudio(getPoemDb(), getAudioBucket(), request, (await params).id); }
  catch (error) { return apiError(error); }
}

export const HEAD = GET;
