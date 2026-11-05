import { env } from 'cloudflare:workers';
import type { MediaValidator } from './media-validation';

export function getMediaValidator(): MediaValidator | undefined {
  return (env as unknown as { MEDIA_VALIDATOR?: MediaValidator }).MEDIA_VALIDATOR;
}
