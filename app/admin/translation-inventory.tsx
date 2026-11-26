'use client';
import { useEffect, useState } from 'react';
import { SITE_LANGUAGES } from '@/lib/site-language';
import type { SiteLanguage } from '@/lib/poem-types';
import type { TranslationStatus } from '@/lib/translation-provenance';
import { adminPoemListUrl, type AdminPoemCollection } from '@/lib/poem-admin-list';

const labels: Record<TranslationStatus | 'original', string> = {
  original: 'Original',
  missing: 'Lipsește',
  stale: 'Original modificat',
  edited: 'Traducere modificată',
  unreviewed: 'Neverificată',
  ready: 'Verificată',
  incomplete: 'Incompletă',
};
type Entry = { id: string; title: string; states: Record<SiteLanguage, keyof typeof labels> };
export default function TranslationInventory({
  collection,
  disabled,
  openPoem,
}: {
  collection: AdminPoemCollection;
  disabled: boolean;
  openPoem: (id: string, language: SiteLanguage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ collection: AdminPoemCollection; rows?: Entry[] } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(adminPoemListUrl(collection.page, collection.q) + '&inventory=1', {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async res => {
        if (!res.ok) throw Error();
        const rows = await res.json();
        if (!controller.signal.aborted) setResult({ collection, rows });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ collection });
      });
    return () => controller.abort();
  }, [collection, open]);
  return (
    <details onToggle={e => setOpen(e.currentTarget.open)}>
      <summary>Inventarul traducerilor</summary>
      {result?.collection !== collection ? (
        <p role="status">Se încarcă…</p>
      ) : !result.rows ? (
        <p role="alert">Inventarul nu a putut fi încărcat. Închide și redeschide panoul.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <caption>Traducerile poemelor de pe această pagină</caption>
            <thead>
              <tr>
                <th>Poem</th>
                {SITE_LANGUAGES.map(lang => (
                  <th key={lang} scope="col">
                    {lang.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map(row => (
                <tr key={row.id}>
                  <th scope="row">{row.title}</th>
                  {SITE_LANGUAGES.map(lang => (
                    <td key={lang}>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={row.title + ' · ' + lang + ' · ' + labels[row.states[lang]]}
                        onClick={() => openPoem(row.id, lang)}
                      >
                        {labels[row.states[lang]]}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
