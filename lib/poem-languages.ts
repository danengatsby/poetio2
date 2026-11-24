import { isExtraLanguage, type Poem, type PoemLanguage, type SiteLanguage } from './poem-types';

export const POEM_LANGUAGES: PoemLanguage[] = ['ro', 'en-US'];

export function otherLanguage(language: PoemLanguage): PoemLanguage {
  return language === 'ro' ? 'en-US' : 'ro';
}

export function poemRecording(
  poem: Pick<Poem, 'source_language' | 'audio_ro_id' | 'audio_en_id'>,
  textLanguage: SiteLanguage,
) {
  const language = isExtraLanguage(textLanguage) ? poem.source_language : textLanguage;
  return { language, id: language === 'en-US' ? poem.audio_en_id : poem.audio_ro_id };
}

/** The poem in a site language: the original, its translation, the French or German version, or null. */
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
    | 'de_title'
    | 'de_theme'
    | 'de_content'
    | 'es_title'
    | 'es_theme'
    | 'es_content'
    | 'it_title'
    | 'it_theme'
    | 'it_content'
  >,
  language: SiteLanguage,
) {
  if (language === poem.source_language) return { title: poem.title, theme: poem.theme, content: poem.content };
  if (isExtraLanguage(language)) {
    const [title, theme, content] = [poem[`${language}_title`], poem[`${language}_theme`], poem[`${language}_content`]];
    if (!title?.trim() || !content?.trim()) return null;
    return { title, theme: theme || '', content };
  }
  if (!poem.translated_title?.trim() || !poem.translated_content?.trim()) return null;
  return { title: poem.translated_title, theme: poem.translated_theme || '', content: poem.translated_content };
}
