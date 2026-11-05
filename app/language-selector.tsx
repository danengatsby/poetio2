'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PoemLanguage } from '@/lib/poem-types';

export default function LanguageSelector({ language, onChange, compact = false }: { language: PoemLanguage; onChange: (language: PoemLanguage) => void; compact?: boolean }) {
  return <ToggleGroup type="single" value={language} onValueChange={value => { if (value === 'ro' || value === 'en-US') onChange(value); }} className="site-language-menu" aria-label={language === 'ro' ? 'Limba site-ului' : 'Site language'}>
    <ToggleGroupItem value="ro" lang="ro" aria-label="Română" title="Română">{compact ? 'RO' : 'Română'}</ToggleGroupItem>
    <ToggleGroupItem value="en-US" lang="en-US" aria-label="English (US)" title="English (US)">{compact ? 'EN' : 'English (US)'}</ToggleGroupItem>
  </ToggleGroup>;
}
