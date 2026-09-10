'use client';

import { defaultPoemImage, poemImage } from '@/lib/poem-images';
import type { Poem } from '@/lib/poem-types';

export default function PoemCover({ poem, className, eager = false }: { poem: Pick<Poem, 'id' | 'image_id'>; className?: string; eager?: boolean }) {
  return <img key={poemImage(poem)} className={className} src={poemImage(poem)} alt="" width={900} height={600} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'} onError={event => {
    const element = event.currentTarget;
    if (element.dataset.fallback) return;
    element.dataset.fallback = 'true';
    element.src = defaultPoemImage(poem.id);
  }} />;
}
