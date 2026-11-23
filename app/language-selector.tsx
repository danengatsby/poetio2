'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, SITE_LANGUAGES } from '@/lib/site-language';

export default function LanguageSelector({
  language,
  onChange,
  compact = false,
}: {
  language: SiteLanguage;
  onChange: (language: SiteLanguage) => void;
  compact?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={language}
      onValueChange={value => {
        if (SITE_LANGUAGES.includes(value as SiteLanguage)) onChange(value as SiteLanguage);
      }}
      className="site-language-menu"
      aria-label={pick(
        language,
        'Limba site-ului',
        'Site language',
        'Langue du site',
        'Sprache der Website',
        'Idioma del sitio',
        'Lingua del sito',
      )}
    >
      <ToggleGroupItem value="ro" lang="ro" aria-label="Română" title="Română">
        {compact ? 'RO' : 'Română'}
      </ToggleGroupItem>
      <ToggleGroupItem value="en-US" lang="en-US" aria-label="English (US)" title="English (US)">
        {compact ? 'EN' : 'English (US)'}
      </ToggleGroupItem>
      <ToggleGroupItem value="fr" lang="fr" aria-label="Français" title="Français">
        {compact ? 'FR' : 'Français'}
      </ToggleGroupItem>
      <ToggleGroupItem value="de" lang="de" aria-label="Deutsch" title="Deutsch">
        {compact ? 'DE' : 'Deutsch'}
      </ToggleGroupItem>
      <ToggleGroupItem value="es" lang="es" aria-label="Español" title="Español">
        {compact ? 'ES' : 'Español'}
      </ToggleGroupItem>
      <ToggleGroupItem value="it" lang="it" aria-label="Italiano" title="Italiano">
        {compact ? 'IT' : 'Italiano'}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
