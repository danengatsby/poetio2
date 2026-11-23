import { AppError } from '../lib/access';
import { MAX_IMAGE_PIXELS } from '../lib/poem-images';

export type ImageInfo = { format: string; width?: number; height?: number };
export type ImageDecoder = {
  info(bytes: Uint8Array): Promise<ImageInfo>;
  decode(bytes: Uint8Array, maxPixels: number): Promise<void>;
};

let active = 0;

export async function validateDecodedImage(bytes: Uint8Array, contentType: string, decoder: ImageDecoder | undefined) {
  if (!decoder)
    throw new AppError(503, 'Verificarea imaginilor nu este disponibilă momentan. Încearcă din nou mai târziu.');
  if (active >= 2) throw new AppError(503, 'Se verifică alte imagini. Așteaptă câteva secunde și încearcă din nou.');
  active++;
  try {
    const { format, width, height } = await decoder.info(bytes);
    if (
      format !== contentType ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new AppError(415, 'Fișierul nu este o imagine JPG, PNG sau WebP validă.');
    }
    if (width * height > MAX_IMAGE_PIXELS)
      throw new AppError(413, 'Imaginea este prea mare. Alege o fotografie de maximum 40 de megapixeli.');
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
