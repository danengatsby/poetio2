import type { Poem } from './poem-types';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const covers: Record<string, string> = {
  'original-3': '/assets/poem-tuesday.webp',
  'original-4': '/assets/poem-rain.webp',
  'original-5': '/assets/poem-repair.webp',
  'original-6': '/assets/poem-spring.webp',
};

export function defaultPoemImage(id: string) {
  return covers[id] || '/assets/blue-hour.webp';
}

export function poemImage(poem: Pick<Poem, 'id' | 'image_id'>) {
  return poem.image_id ? `/api/images/${poem.image_id}` : defaultPoemImage(poem.id);
}
