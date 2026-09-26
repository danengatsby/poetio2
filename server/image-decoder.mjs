import sharp from 'sharp';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const imageDecoder = {
  async info(bytes) {
    // Reading metadata does not allocate the pixel raster. The shared policy
    // checks its dimensions before decoding, including all WebP frames.
    const { format, width, height } = await sharp(bytes, { animated: true, limitInputPixels: false, failOn: 'warning' }).metadata();
    return { format: `image/${format}`, width, height };
  },
  async decode(bytes, maxPixels) {
    await pipeline(
      sharp(bytes, { animated: true, limitInputPixels: maxPixels, failOn: 'warning' }).timeout({ seconds: 15 }).raw(),
      new Writable({ write(_chunk, _encoding, done) { done(); } }),
    );
  },
};
