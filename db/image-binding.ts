import { env } from 'cloudflare:workers';
import type { ImageBucket } from './images';

export function getImageBucket(): ImageBucket {
  if (!env.BUCKET) throw new Error('Poem image storage unavailable');
  return env.BUCKET;
}
