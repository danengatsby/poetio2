import { env } from '../server/vps-env';
import type { ImageBucket } from './images';
import type { ImageDecoder } from './image-validation';

export function getImageBucket(): ImageBucket {
  // Node's web streams differ from the DOM typings only in iterator details.
  const bucket = (env as unknown as { BUCKET?: ImageBucket }).BUCKET;
  if (!bucket) throw new Error('Poem image storage unavailable');
  return bucket;
}

export function getImageDecoder(): ImageDecoder | undefined {
  return (env as unknown as { IMAGE_DECODER?: ImageDecoder }).IMAGE_DECODER;
}
