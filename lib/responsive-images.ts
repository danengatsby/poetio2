import { generatedImages } from './generated-images';

export function responsiveImage(source: string) {
  const variants = source.startsWith('/api/images/')
    ? [320, 480, 640, 960, 1280].map(width => ({ src: `${source}?w=${width}`, width }))
    : generatedImages[source];
  if (!variants?.length) return { src: source };
  return { src: (variants.find(item => item.width >= 640) || variants[variants.length - 1]).src,
    srcSet: variants.map(item => `${item.src} ${item.width}w`).join(', ') };
}

export const cardImageSizes = '(max-width: 420px) calc(100vw - 40px), (max-width: 760px) calc(50vw - 52px), (max-width: 1050px) calc(20vw - 48px), (max-width: 1432px) calc(20vw - 78.4px), 208px';
