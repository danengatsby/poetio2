import { join } from 'node:path';
import { openDatabase, openImageBucket, openAudioBucket } from './vps-storage.mjs';

let database: ReturnType<typeof openDatabase> | undefined;
let bucket: ReturnType<typeof openImageBucket> | undefined;
let audioBucket: ReturnType<typeof openAudioBucket> | undefined;
const dataDirectory = () => process.env.POETIO_DATA_DIR || '/var/lib/poetio';

// This module replaces cloudflare:workers only in the explicit Node build.
// Bindings are lazy so compiling never creates or modifies the live database.
export const env = {
  ADMIN_AUTH_MODE: 'basic',
  get DB() { return database ??= openDatabase(join(dataDirectory(), 'poetio.sqlite3')); },
  get BUCKET() { return bucket ??= openImageBucket(join(dataDirectory(), 'images')); },
  get AUDIO_BUCKET() { return audioBucket ??= openAudioBucket(join(dataDirectory(), 'audio')); },
  get OPENAI_API_KEY() { return process.env.OPENAI_API_KEY; },
  get OPENAI_TRANSLATION_MODEL() { return process.env.OPENAI_TRANSLATION_MODEL; },
};
