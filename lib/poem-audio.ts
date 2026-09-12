import type { PoemLanguage } from './poem-types';

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/ogg';
export const AUDIO_FIELDS = ['audio_ro_id', 'audio_en_id'] as const;
export type AudioField = typeof AUDIO_FIELDS[number];

export function audioField(language: PoemLanguage): AudioField {
  return language === 'ro' ? 'audio_ro_id' : 'audio_en_id';
}

export function audioFileType(file: Pick<File, 'name'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({ mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg' } as Record<string, string>)[extension || ''] || null;
}
