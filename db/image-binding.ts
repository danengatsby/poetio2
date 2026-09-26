import { env } from 'cloudflare:workers';
import type { ImageBucket } from './images';
import { cloudflareImageDecoder, type ImageDecoder, type CloudflareImages } from './image-validation';

export function getImageBucket(): ImageBucket {
  if (!env.BUCKET) throw new Error('Poem image storage unavailable');
  return env.BUCKET;
}

export function getImageDecoder(): ImageDecoder | undefined {
  const runtime = env as unknown as { IMAGE_DECODER?: ImageDecoder; IMAGES?: CloudflareImages };
  return runtime.IMAGE_DECODER ?? (runtime.IMAGES ? cloudflareImageDecoder(runtime.IMAGES) : undefined);
}
