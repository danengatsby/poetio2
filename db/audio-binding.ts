import { env } from 'cloudflare:workers';
import type { AudioBucket } from './audio';

export function getAudioBucket(): AudioBucket {
  const bindings = env as unknown as { AUDIO_BUCKET?: AudioBucket; BUCKET?: AudioBucket };
  const bucket = bindings.AUDIO_BUCKET || bindings.BUCKET;
  if (!bucket) throw new Error('Poem audio storage unavailable');
  return bucket;
}
