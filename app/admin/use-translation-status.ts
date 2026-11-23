'use client';
import { useEffect, useState } from 'react';
import type { PoemInput } from '@/lib/poem-types';
import {
  sourceKey,
  translatedKey,
  translationStatus,
  versionFields,
  versionKey,
  type TranslationStatus,
  type TranslationTarget,
} from '@/lib/translation-provenance';

/** Whether the translation (or a language's own version) is checked against the current original. */
export function useTranslationStatus(draft: PoemInput | null, target: TranslationTarget = 'translated') {
  // Invalidate immediately on edits, before the asynchronous digest finishes.
  const key = draft
    ? JSON.stringify([
        target,
        sourceKey(draft),
        target === 'translated' ? translatedKey(draft) : versionKey(draft, target),
        versionFields(draft, target).provenance ?? null,
      ])
    : '';
  const [result, setResult] = useState<{ key: string; status: TranslationStatus | 'error' } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const [which, source, text, provenance] = JSON.parse(key) as [TranslationTarget, string, string, unknown];
    const [source_language, title, theme, content] = JSON.parse(source);
    const [versionTitle, versionTheme, versionContent] = JSON.parse(text);
    const prefix = which === 'translated' ? 'translated' : which;
    const version = {
      [`${prefix}_title`]: versionTitle,
      [`${prefix}_theme`]: versionTheme,
      [`${prefix}_content`]: versionContent,
      [which === 'translated' ? 'translation_provenance' : `${which}_provenance`]: provenance,
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
