import type { SiteLanguage } from './poem-types';

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/ogg';
export const AUDIO_LABELS = {
  audio_ro_id: 'Română',
  audio_en_id: 'English (US)',
  audio_fr_id: 'Français',
  audio_de_id: 'Deutsch',
  audio_es_id: 'Español',
  audio_it_id: 'Italiano',
} as const;
export type AudioField = keyof typeof AUDIO_LABELS;
export const AUDIO_FIELDS = Object.keys(AUDIO_LABELS) as AudioField[];

export function audioField(language: SiteLanguage): AudioField {
  return `audio_${language === 'en-US' ? 'en' : language}_id`;
}

export function audioFileType(file: Pick<File, 'name'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return (
    ({ mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg' } as Record<string, string>)[
      extension || ''
    ] || null
  );
}
