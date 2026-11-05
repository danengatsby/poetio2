import { openOperations } from './operations.mjs';
import { createBookSearch } from '../db/book-search';
import type { Database } from '../db/poems';
import type { TextRenderer } from '../db/book-text';
import { openImageRenderer } from './image-renderer.mjs';
import { imageDecoder } from './image-decoder.mjs';
import { openBookRenderer } from './book-renderer.mjs';
import { openMediaValidator } from './media-validator.mjs';
import { join } from 'node:path';
import { openDatabase, openImageBucket, openAudioBucket, openVideoBucket, openBookBucket } from './vps-storage.mjs';

let operations: ReturnType<typeof openOperations> | undefined;
const getOperations = () => operations ??= openOperations(dataDirectory());
let imageRenderer: ReturnType<typeof openImageRenderer> | undefined;
let database: ReturnType<typeof openDatabase> | undefined;
let bucket: ReturnType<typeof openImageBucket> | undefined;
let audioBucket: ReturnType<typeof openAudioBucket> | undefined;
let videoBucket: ReturnType<typeof openVideoBucket> | undefined;
let bookBucket: ReturnType<typeof openBookBucket> | undefined;
let bookRenderer: ReturnType<typeof openBookRenderer> | undefined;
let mediaValidator: ReturnType<typeof openMediaValidator> | undefined;
let bookSearch: ReturnType<typeof createBookSearch> | undefined;
const dataDirectory = () => process.env.POETIO_DATA_DIR || '/var/lib/poetio';

// This module replaces cloudflare:workers only in the explicit Node build.
// Bindings are lazy so compiling never creates or modifies the live database.
export const env = {
  get OPERATIONS() { return getOperations(); },
  ADMIN_AUTH_MODE: 'basic',
  IMAGE_DECODER: imageDecoder,
  get MEDIA_VALIDATOR() { return mediaValidator ??= getOperations().observe('media', openMediaValidator(dataDirectory())); },
  get IMAGE_RENDERER() { return imageRenderer ??= getOperations().observe('image', openImageRenderer(dataDirectory())); },
  get DB() { return database ??= openDatabase(join(dataDirectory(), 'poetio.sqlite3')); },
  get BUCKET() { return bucket ??= openImageBucket(join(dataDirectory(), 'images')); },
  get AUDIO_BUCKET() { return audioBucket ??= openAudioBucket(join(dataDirectory(), 'audio')); },
  get VIDEO_BUCKET() { return videoBucket ??= openVideoBucket(join(dataDirectory(), 'videos')); },
  get BOOK_RENDERER() { return bookRenderer ??= getOperations().observe('book', openBookRenderer(dataDirectory())); },
  get BOOK_SEARCH() { return bookSearch ??= createBookSearch(env.DB as unknown as Database, env.BOOK_RENDERER as TextRenderer); },
  get BOOK_BUCKET() { return bookBucket ??= openBookBucket(join(dataDirectory(), 'books')); },
  get OPENAI_API_KEY() { return process.env.OPENAI_API_KEY; },
  get OPENAI_TRANSLATION_MODEL() { return process.env.OPENAI_TRANSLATION_MODEL; },
};
