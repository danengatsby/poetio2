'use client';
import { useEffect, useState } from 'react';
import type { PoemInput } from '@/lib/poem-types';
import { sourceKey, translatedKey, translationStatus, type TranslationStatus } from '@/lib/translation-provenance';

export function useTranslationStatus(draft: PoemInput | null) {
  // Invalidate immediately on edits, before the asynchronous digest finishes.
  const key = draft ? JSON.stringify([sourceKey(draft), translatedKey(draft), draft.translation_provenance ?? null]) : '';
  const [result, setResult] = useState<{ key: string; status: TranslationStatus | 'error' } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [source, translated, provenance] = JSON.parse(key);
    const [source_language, title, theme, content] = JSON.parse(source);
    const [translated_title, translated_theme, translated_content] = JSON.parse(translated);
    void translationStatus({ title, theme, content, author: '', source_language, translated_title, translated_theme, translated_content, translation_provenance: provenance })
      .then(status => { if (!cancelled) setResult({ key, status }); })
      .catch(() => { if (!cancelled) setResult({ key, status: 'error' }); });
    return () => { cancelled = true; };
  }, [key]);
  return result?.key === key ? result.status : 'checking';
}
