export type PoemLanguage = 'ro' | 'en-US';

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
  image_id: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
};

export type PoemInput = Pick<Poem, 'title' | 'author' | 'theme' | 'content'> & {
  image_id?: string | null;
  source_language?: PoemLanguage;
  translated_title?: string | null;
  translated_theme?: string | null;
  translated_content?: string | null;
};
