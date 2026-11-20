'use client';

import { useState } from 'react';
import { poemFieldLabels, type PoemField } from '@/lib/poem-recovery';
import type { PoemInput } from '@/lib/poem-types';

function describe(field: PoemField, value: PoemInput[PoemField]) {
  if (field === 'source_language') return value === 'ro' ? 'Română' : 'English (US)';
  if (value && typeof value === 'object') return value.origin === 'manual' ? 'Revizuire manuală' : 'Traducere automată';
  return String(value || '—');
}

export default function PoemRecoveryComparison({ draft, current, fields, baseRevision, currentRevision, onApply, onCancel }: {
  draft: PoemInput; current: PoemInput; fields: PoemField[]; baseRevision: number; currentRevision: number;
  onApply: (keepPublished: PoemField[]) => void; onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Partial<Record<PoemField, 'published' | 'draft'>>>({});
  return <section className="recovery-preview" aria-label="Compară versiunile">
    <h2>Compară schița cu poemul publicat</h2>
    <p>Schița pornește de la versiunea {baseRevision}. Acum este publicată versiunea {currentRevision}. Alege valoarea fiecărui câmp înainte să continui.</p>
    {fields.map(field => <fieldset key={field}><legend>{poemFieldLabels[field]}</legend>
      {(['published', 'draft'] as const).map(source => <label key={source} className="poem-recovery-choice">
        <input type="radio" name={'compare-' + field} checked={choices[field] === source}
          onChange={() => setChoices(previous => ({ ...previous, [field]: source }))} />
        <span>{source === 'published' ? 'Păstrează valoarea publicată' : 'Folosește valoarea din schiță'}
          <span className="poem-recovery-value">{describe(field, (source === 'published' ? current : draft)[field])}</span>
        </span>
      </label>)}
    </fieldset>)}
    <button type="button" className="primary-button" disabled={fields.some(field => !choices[field])}
      onClick={() => onApply(fields.filter(field => choices[field] === 'published'))}>Aplică alegerile în editor</button>
    <button type="button" className="text-button" onClick={onCancel}>Anulează recuperarea</button>
  </section>;
}
