'use client';
import { useEffect, useState } from 'react';
import type { PoemInput } from '@/lib/poem-types';
import {
  frenchKey,
  sourceKey,
  translatedKey,
  translationStatus,
  type TranslationStatus,
  type TranslationTarget,
} from '@/lib/translation-provenance';

/** Whether the translation (or the French version) is checked against the current original. */
export function useTranslationStatus(draft: PoemInput | null, target: TranslationTarget = 'translated') {
  // Invalidate immediately on edits, before the asynchronous digest finishes.
  const key = draft
    ? JSON.stringify([
        target,
        sourceKey(draft),
        target === 'fr' ? frenchKey(draft) : translatedKey(draft),
        (target === 'fr' ? draft.fr_provenance : draft.translation_provenance) ?? null,
      ])
    : '';
  const [result, setResult] = useState<{ key: string; status: TranslationStatus | 'error' } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [which, source, text, provenance] = JSON.parse(key);
    const [source_language, title, theme, content] = JSON.parse(source);
    const [versionTitle, versionTheme, versionContent] = JSON.parse(text);
    const version =
      which === 'fr'
        ? { fr_title: versionTitle, fr_theme: versionTheme, fr_content: versionContent, fr_provenance: provenance }
        : {
            translated_title: versionTitle,
            translated_theme: versionTheme,
            translated_content: versionContent,
            translation_provenance: provenance,
          };
    void translationStatus({ title, theme, content, author: '', source_language, ...version }, which)
      .then(status => {
        if (!cancelled) setResult({ key, status });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return result?.key === key ? result.status : 'checking';
}
