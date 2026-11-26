import type { AudioField } from './poem-audio';
import type { TranslationProvenance } from './translation-provenance';
/** The language a poem is written in; its one `translated_*` version is in the other. */
export type PoemLanguage = 'ro' | 'en-US';
/** Languages with their own version of each poem (`fr_*`, `de_*`, `es_*`, `it_*`), besides the translation. */
export const EXTRA_LANGUAGES = ['fr', 'de', 'es', 'it'] as const;
export type ExtraLanguage = (typeof EXTRA_LANGUAGES)[number];
/** The languages of the site. */
export type SiteLanguage = PoemLanguage | ExtraLanguage;
export const isExtraLanguage = (language: string): language is ExtraLanguage =>
  (EXTRA_LANGUAGES as readonly string[]).includes(language);

export type Poem = Record<AudioField, string | null> & {
  id: string;
  title: string;
  author: string;
  theme: string;
  content: string;
  source_language: PoemLanguage;
  translated_title: string | null;
  translated_theme: string | null;
  translated_content: string | null;
  translation_provenance?: TranslationProvenance | null;
  fr_title?: string | null;
  fr_theme?: string | null;
  fr_content?: string | null;
  fr_provenance?: TranslationProvenance | null;
  de_title?: string | null;
  de_theme?: string | null;
  de_content?: string | null;
  de_provenance?: TranslationProvenance | null;
  es_title?: string | null;
  es_theme?: string | null;
  es_content?: string | null;
  es_provenance?: TranslationProvenance | null;
  it_title?: string | null;
  it_theme?: string | null;
  it_content?: string | null;
  it_provenance?: TranslationProvenance | null;
  image_id: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
};

export type PoemWithCommentCount = Poem & { comment_count: number };

export type PoemInput = Pick<Poem, 'title' | 'author' | 'theme' | 'content'> &
  Partial<Pick<Poem, AudioField>> & {
    image_id?: string | null;
    source_language?: PoemLanguage;
    translated_title?: string | null;
    translated_theme?: string | null;
    translated_content?: string | null;
    translation_provenance?: TranslationProvenance | null;
    fr_title?: string | null;
    fr_theme?: string | null;
    fr_content?: string | null;
    fr_provenance?: TranslationProvenance | null;
    de_title?: string | null;
    de_theme?: string | null;
    de_content?: string | null;
    de_provenance?: TranslationProvenance | null;
    es_title?: string | null;
    es_theme?: string | null;
    es_content?: string | null;
    es_provenance?: TranslationProvenance | null;
    it_title?: string | null;
    it_theme?: string | null;
    it_content?: string | null;
    it_provenance?: TranslationProvenance | null;
  };
