'use client';
/* eslint-disable @next/next/no-img-element -- Native srcset uses the bounded private image renderer. */
import { responsiveImage, cardImageSizes } from '@/lib/responsive-images';

import { defaultPoemImage, poemImage } from '@/lib/poem-images';
import type { Poem } from '@/lib/poem-types';

export default function PoemCover({ poem, className, eager = false }: { poem: Pick<Poem, 'id' | 'image_id'>; className?: string; eager?: boolean }) {
  return <img key={poemImage(poem)} className={className} {...responsiveImage(poemImage(poem))} sizes={className === 'list-cover' ? '48px' : cardImageSizes} alt="" width={900} height={600} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'} onError={event => {
    const element = event.currentTarget;
    if (element.dataset.fallback) return;
    element.dataset.fallback = 'true';
    const fallback = responsiveImage(defaultPoemImage(poem.id));
    element.srcset = fallback.srcSet || '';
    element.src = fallback.src;
  }} />;
}
