import { env } from 'cloudflare:workers';
import type { AudioBucket } from './audio';

export function getBookBucket(): AudioBucket {
  const bindings = env as unknown as { BOOK_BUCKET?: AudioBucket; BUCKET?: AudioBucket };
  const bucket = bindings.BOOK_BUCKET || bindings.BUCKET;
  if (!bucket) throw new Error('Book storage unavailable');
  return bucket;
}
