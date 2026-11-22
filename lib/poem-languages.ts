import type { Poem, PoemLanguage, SiteLanguage } from './poem-types';

export const POEM_LANGUAGES: PoemLanguage[] = ['ro', 'en-US'];

export function otherLanguage(language: PoemLanguage): PoemLanguage {
  return language === 'ro' ? 'en-US' : 'ro';
}

/** The poem in a site language: the original, its translation, the French version, or null if missing. */
export function poemVersion(
  poem: Pick<
    Poem,
    | 'title'
    | 'theme'
    | 'content'
    | 'source_language'
    | 'translated_title'
    | 'translated_theme'
    | 'translated_content'
    | 'fr_title'
    | 'fr_theme'
    | 'fr_content'
  >,
  language: SiteLanguage,
) {
  if (language === poem.source_language) return { title: poem.title, theme: poem.theme, content: poem.content };
  if (language === 'fr') {
    if (!poem.fr_title?.trim() || !poem.fr_content?.trim()) return null;
    return { title: poem.fr_title, theme: poem.fr_theme || '', content: poem.fr_content };
  }
  if (!poem.translated_title?.trim() || !poem.translated_content?.trim()) return null;
  return { title: poem.translated_title, theme: poem.translated_theme || '', content: poem.translated_content };
}
