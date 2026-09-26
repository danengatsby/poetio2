import { AppError } from '../lib/access';
import { MAX_IMAGE_PIXELS } from '../lib/poem-images';

export type ImageInfo = { format: string; width?: number; height?: number };
export type ImageDecoder = {
  info(bytes: Uint8Array): Promise<ImageInfo>;
  decode(bytes: Uint8Array, maxPixels: number): Promise<void>;
};

let active = 0;

export async function validateDecodedImage(bytes: Uint8Array, contentType: string, decoder: ImageDecoder | undefined) {
  if (!decoder) throw new AppError(503, 'Verificarea imaginilor nu este disponibilă momentan. Încearcă din nou mai târziu.');
  if (active >= 2) throw new AppError(503, 'Se verifică alte imagini. Așteaptă câteva secunde și încearcă din nou.');
  active++;
  try {
    const { format, width, height } = await decoder.info(bytes);
    if (format !== contentType || typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
      throw new AppError(415, 'Fișierul nu este o imagine JPG, PNG sau WebP validă.');
    }
    if (width * height > MAX_IMAGE_PIXELS) throw new AppError(413, 'Imaginea este prea mare. Alege o fotografie de maximum 40 de megapixeli.');
    // Metadata alone cannot detect corrupt/truncated pixel data. Complete the
    // decode before allowing either an object or a database row to be written.
    await decoder.decode(bytes, MAX_IMAGE_PIXELS);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(415, 'Imaginea nu poate fi decodată complet. Alege un alt fișier JPG, PNG sau WebP.');
  } finally {
    active--;
  }
}

export type CloudflareImages = {
  info(stream: ReadableStream<Uint8Array>): Promise<ImageInfo>;
  input(stream: ReadableStream<Uint8Array>): {
    output(options: { format: string; quality: number; anim: boolean }): Promise<{ response(): Response }>;
  };
};

export function cloudflareImageDecoder(images: CloudflareImages): ImageDecoder {
  const stream = (bytes: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
  return {
    info: bytes => images.info(stream(bytes)),
    async decode(bytes) {
      // Force pixel decoding, including animation frames, without replacing the
      // uploaded original. Drain the result so deferred stream errors surface.
      const response = (await images.input(stream(bytes)).output({ format: 'image/webp', quality: 1, anim: true })).response();
      if (!response.ok || !response.body) throw new AppError(503, 'Verificarea imaginii nu a reușit. Încearcă din nou.');
      const reader = response.body.getReader();
      try { while (!(await reader.read()).done) { /* Discard validation output. */ } }
      finally { reader.releaseLock(); }
    },
  };
}
