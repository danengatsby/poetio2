'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PoemLanguage } from '@/lib/poem-types';

export default function LanguageSelector({ language, onChange }: { language: PoemLanguage; onChange: (language: PoemLanguage) => void }) {
  return <ToggleGroup type="single" value={language} onValueChange={value => { if (value === 'ro' || value === 'en-US') onChange(value); }} className="site-language-menu" aria-label={language === 'ro' ? 'Limba site-ului' : 'Site language'}>
    <ToggleGroupItem value="ro" lang="ro">Română</ToggleGroupItem>
    <ToggleGroupItem value="en-US" lang="en-US">English (US)</ToggleGroupItem>
  </ToggleGroup>;
}
