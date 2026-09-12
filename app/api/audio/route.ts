import { getPoemDb } from '@/db/binding';
import { getAudioBucket } from '@/db/audio-binding';
import { saveAudio } from '@/db/audio';
import { apiError, requireSameOriginOwner } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    requireSameOriginOwner(request);
    const audio = await saveAudio(getPoemDb(), getAudioBucket(), request);
    return Response.json({ audio: { id: audio.id, url: `/api/audio/${audio.id}`, file_name: audio.file_name } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
