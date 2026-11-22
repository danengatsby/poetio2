import type { PoemInput } from './poem-types';

export type TranslationProvenance = {
  version: 1;
  origin: 'automatic' | 'manual';
  sourceHash: string;
  textHash: string;
};
export type TranslationStatus = 'missing' | 'incomplete' | 'unreviewed' | 'stale' | 'edited' | 'ready';

export function parseTranslationProvenance(value: unknown): TranslationProvenance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    (data.origin !== 'automatic' && data.origin !== 'manual') ||
    typeof data.sourceHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.sourceHash) ||
    typeof data.textHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.textHash)
  )
    return null;
  return { version: 1, origin: data.origin, sourceHash: data.sourceHash, textHash: data.textHash };
}

// Match the API's normalization exactly. Author, media and database revision do
// not affect a translation; title, theme, language and every verse do.
export function sourceKey(poem: PoemInput) {
  return JSON.stringify([
    poem.source_language ?? 'ro',
    poem.title.trim(),
    poem.theme.trim(),
    poem.content.replace(/\r\n?/g, '\n'),
  ]);
}
export function translatedKey(poem: PoemInput) {
  return JSON.stringify([
    poem.translated_title?.trim() || '',
    poem.translated_theme?.trim() || '',
    poem.translated_content?.replace(/\r\n?/g, '\n') || '',
  ]);
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** The French version, tracked like the translation but with its own provenance (fr_provenance). */
export function frenchKey(poem: PoemInput) {
  return JSON.stringify([
    poem.fr_title?.trim() || '',
    poem.fr_theme?.trim() || '',
    poem.fr_content?.replace(/\r\n?/g, '\n') || '',
  ]);
}
/** Which version of a poem: its one translation (`translated_*`) or the French one (`fr_*`). */
export type TranslationTarget = 'translated' | 'fr';
export async function translationProvenance(
  poem: PoemInput,
  origin: TranslationProvenance['origin'],
  target: TranslationTarget = 'translated',
): Promise<TranslationProvenance> {
  const [sourceHash, textHash] = await Promise.all([
    digest(sourceKey(poem)),
    digest(target === 'fr' ? frenchKey(poem) : translatedKey(poem)),
  ]);
  return { version: 1, origin, sourceHash, textHash };
}
export async function translationStatus(
  poem: PoemInput,
  target: TranslationTarget = 'translated',
): Promise<TranslationStatus> {
  const [titleValue, themeValue, contentValue, provenance] =
    target === 'fr'
      ? [poem.fr_title, poem.fr_theme, poem.fr_content, poem.fr_provenance]
      : [poem.translated_title, poem.translated_theme, poem.translated_content, poem.translation_provenance];
  const title = Boolean(titleValue?.trim()),
    content = Boolean(contentValue?.trim());
  if (!title && !content && !themeValue?.trim()) return 'missing';
  if (!title || !content) return 'incomplete';
  const stored = parseTranslationProvenance(provenance);
  if (!stored) return 'unreviewed';
  const current = await translationProvenance(poem, stored.origin, target);
  if (stored.sourceHash !== current.sourceHash) return 'stale';
  if (stored.textHash !== current.textHash) return 'edited';
  return 'ready';
}
