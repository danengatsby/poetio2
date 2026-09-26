import { env } from 'cloudflare:workers';
import type { AudioBucket } from './audio';

export function getVideoBucket(): AudioBucket {
  const bindings = env as unknown as { VIDEO_BUCKET?: AudioBucket; BUCKET?: AudioBucket };
  const bucket = bindings.VIDEO_BUCKET || bindings.BUCKET;
  if (!bucket) throw new Error('Video storage unavailable');
  return bucket;
}
