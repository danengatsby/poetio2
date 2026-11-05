import { env } from 'cloudflare:workers';
import type { AudioBucket } from './audio';
import type { BookValidator } from './book-validation';
import type { TextRenderer } from './book-text';

export function getBookTextRenderer(): TextRenderer | undefined {
  return (env as unknown as { BOOK_RENDERER?: TextRenderer }).BOOK_RENDERER;
}

export function getBookValidator(): BookValidator | undefined {
  return (env as unknown as { BOOK_RENDERER?: BookValidator }).BOOK_RENDERER;
}

export function getBookBucket(): AudioBucket {
  const bindings = env as unknown as { BOOK_BUCKET?: AudioBucket; BUCKET?: AudioBucket };
  const bucket = bindings.BOOK_BUCKET || bindings.BUCKET;
  if (!bucket) throw new Error('Book storage unavailable');
  return bucket;
}
