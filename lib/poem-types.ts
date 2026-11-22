import type { TranslationProvenance } from './translation-provenance';
/** The language a poem is written in; its one `translated_*` version is in the other. */
export type PoemLanguage = 'ro' | 'en-US';
/** The languages of the site. French has its own `fr_*` version of each poem. */
export type SiteLanguage = PoemLanguage | 'fr';

export type Poem = {
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
  image_id: string | null;
  audio_ro_id: string | null;
  audio_en_id: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
};

export type PoemWithCommentCount = Poem & { comment_count: number };

export type PoemInput = Pick<Poem, 'title' | 'author' | 'theme' | 'content'> & {
  image_id?: string | null;
  audio_ro_id?: string | null;
  audio_en_id?: string | null;
  source_language?: PoemLanguage;
  translated_title?: string | null;
  translated_theme?: string | null;
  translated_content?: string | null;
  translation_provenance?: TranslationProvenance | null;
  fr_title?: string | null;
  fr_theme?: string | null;
  fr_content?: string | null;
  fr_provenance?: TranslationProvenance | null;
};
