import type { Poem, PoemInput, PoemLanguage } from './poem-types';

export const POEM_LANGUAGES: PoemLanguage[] = ['ro', 'en-US'];

export function otherLanguage(language: PoemLanguage): PoemLanguage {
  return language === 'ro' ? 'en-US' : 'ro';
}

export function poemVersion(poem: Poem, language: PoemLanguage) {
  if (language === poem.source_language) return { title: poem.title, theme: poem.theme, content: poem.content };
  if (!poem.translated_title?.trim() || !poem.translated_content?.trim()) return null;
  return { title: poem.translated_title, theme: poem.translated_theme || '', content: poem.translated_content };
}

export function needsEnglishTranslation(poem: PoemInput, previous?: PoemInput | null) {
  if ((poem.source_language || 'ro') !== 'ro') return false;
  if (!poem.translated_title?.trim() || !poem.translated_content?.trim()) return true;
  if (!previous) return false;
  const originalChanged = poem.title !== previous.title || poem.theme !== previous.theme || poem.content !== previous.content || poem.source_language !== previous.source_language;
  const translationChanged = poem.translated_title !== previous.translated_title || poem.translated_theme !== previous.translated_theme || poem.translated_content !== previous.translated_content;
  // A manually revised translation takes precedence. Unchanged translations
  // are refreshed when the Romanian original changes.
  return originalChanged && !translationChanged;
}
