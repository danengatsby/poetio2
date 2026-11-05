import type { Poem, PoemLanguage } from './poem-types';

export const POEM_LANGUAGES: PoemLanguage[] = ['ro', 'en-US'];

export function otherLanguage(language: PoemLanguage): PoemLanguage {
  return language === 'ro' ? 'en-US' : 'ro';
}

export function poemVersion(poem: Pick<Poem, 'title' | 'theme' | 'content' | 'source_language' | 'translated_title' | 'translated_theme' | 'translated_content'>, language: PoemLanguage) {
  if (language === poem.source_language) return { title: poem.title, theme: poem.theme, content: poem.content };
  if (!poem.translated_title?.trim() || !poem.translated_content?.trim()) return null;
  return { title: poem.translated_title, theme: poem.translated_theme || '', content: poem.translated_content };
}
