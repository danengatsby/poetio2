import { AppError } from '../lib/access';

export type MediaKind = 'audio' | 'video';
export type MediaFile = { id: string; object_key: string; content_type: string; content_hash: string; byte_size: number };
export type MediaCheck = { status: 'ready'; kind: MediaKind; hash: string; bytes: number; duration: number; audioStreams: number; videoStreams: number };
export type MediaValidator = {
  checkUpload(bytes: Uint8Array, kind: MediaKind, contentType: string): Promise<MediaCheck>;
  validation(file: MediaFile, kind: MediaKind): Promise<MediaCheck>;
};
const messages = {
  invalid: 'Fișierul audio/video este incomplet sau nu poate fi decodat integral. Exportă-l din nou și selectează fișierul înlocuitor. Datele din editor sunt păstrate.',
  unsupported: 'Formatul de redare nu este acceptat. Folosește MP3, WAV PCM, M4A AAC, OGG Opus/Vorbis, MP4 H.264 cu AAC sau WebM VP8/VP9 cu Opus/Vorbis.',
  limits: 'Fișierul depășește limitele de procesare. Redu durata sau rezoluția și încarcă-l din nou. Datele din editor sunt păstrate.',
  unavailable: 'Verificarea audio/video nu este disponibilă momentan. Reîncearcă salvarea; datele și fișierul selectat sunt păstrate în editor.',
};
async function checked(task: () => Promise<MediaCheck>, file: { content_hash: string; byte_size: number }, kind: MediaKind) {
  try {
    const result = await task();
    if (result?.status !== 'ready' || result.kind !== kind || result.hash !== file.content_hash || result.bytes !== file.byte_size ||
      !Number.isFinite(result.duration) || result.duration <= 0 || !Number.isSafeInteger(result.audioStreams) || !Number.isSafeInteger(result.videoStreams) ||
      (kind === 'audio' ? result.audioStreams !== 1 || result.videoStreams !== 0 : result.videoStreams !== 1 || ![0, 1].includes(result.audioStreams))) throw new Error('Incomplete media verification');
    return result;
  } catch (error) {
    const raw = error && typeof error === 'object' && 'code' in error ? error.code : null;
    const code = raw === 'invalid' || raw === 'unsupported' || raw === 'limits' ? raw : 'unavailable';
    throw new AppError(code === 'unavailable' ? 503 : 422, messages[code]);
  }
}
function requireValidator(validator: MediaValidator | undefined): asserts validator is MediaValidator {
  if (!validator) throw new AppError(503, messages.unavailable);
}
export async function validateMediaUpload(bytes: Uint8Array, kind: MediaKind, contentType: string, hash: string, validator?: MediaValidator) {
  requireValidator(validator);
  return checked(() => validator.checkUpload(bytes, kind, contentType), { content_hash: hash, byte_size: bytes.length }, kind);
}
export async function requireReadyMedia(file: MediaFile, kind: MediaKind, validator?: MediaValidator) {
  requireValidator(validator);
  return checked(() => validator.validation(file, kind), file, kind);
}
