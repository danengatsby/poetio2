import type { EditorSnapshot } from './editorial';
import type { PoemInput } from './poem-types';

export const mediaFields = ['image_id', 'audio_ro_id', 'audio_en_id'] as const;
export type PoemMediaField = (typeof mediaFields)[number];

export const poemFieldLabels = {
  title: 'Titlu',
  author: 'Autor',
  theme: 'Temă',
  content: 'Textul original',
  source_language: 'Limba originalului',
  translated_title: 'Titlul traducerii',
  translated_theme: 'Tema traducerii',
  translated_content: 'Textul traducerii',
  image_id: 'Imagine',
  audio_ro_id: 'Înregistrare RO',
  audio_en_id: 'Înregistrare EN',
  translation_provenance: 'Revizuirea traducerii',
  fr_title: 'Titlul în franceză',
  fr_theme: 'Tema în franceză',
  fr_content: 'Textul în franceză',
  fr_provenance: 'Revizuirea versiunii în franceză',
} satisfies Record<keyof PoemInput, string>;
export type PoemField = keyof typeof poemFieldLabels;

export function pendingPoemMedia(snapshot: EditorSnapshot): PoemMediaField[] {
  const fields = snapshot.pendingPoemFiles;
  if (Array.isArray(fields) && fields.length && fields.every(field => mediaFields.includes(field))) {
    return mediaFields.filter(field => fields.includes(field));
  }
  // Older drafts only recorded that at least one file was pending.
  return snapshot.pendingFiles ? [...mediaFields] : [];
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? '') === JSON.stringify(right ?? '');
}

export function conflictingPoemFields(
  draft: PoemInput,
  current: PoemInput,
  base: PoemInput | null,
  pending: PoemMediaField[],
) {
  return (Object.keys(poemFieldLabels) as PoemField[]).filter(
    field =>
      (!base || !sameValue(current[field], base[field])) &&
      (!sameValue(current[field], draft[field]) || pending.some(key => key === field)),
  );
}
