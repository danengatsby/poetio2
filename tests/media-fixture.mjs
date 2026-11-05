import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
export const mediaFixture = name => readFileSync(new URL(`./fixtures/media/${name}`, import.meta.url));
// Database-only tests isolate persistence from the real FFmpeg integration suite.
export const readyMediaValidator = {
  async checkUpload(bytes, kind) { return { status: 'ready', kind, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, duration: 1, audioStreams: kind === 'audio' ? 1 : 0, videoStreams: kind === 'video' ? 1 : 0 }; },
  async validation(file, kind) { return { status: 'ready', kind, hash: file.content_hash, bytes: file.byte_size, duration: 1, audioStreams: kind === 'audio' ? 1 : 0, videoStreams: kind === 'video' ? 1 : 0 }; },
};
