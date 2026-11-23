'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick } from '@/lib/site-language';

export default function ThemeToggle({ language = 'ro' }: { language?: SiteLanguage }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="outline"
      className="theme-toggle"
      lang={language}
      title={pick(
        language,
        'Schimbă tema: noapte / zi',
        'Switch theme: night / day',
        'Changer de thème\u00a0: nuit / jour',
        'Design wechseln: Nacht / Tag',
        'Cambiar de tema: noche / día',
        'Cambia tema: notte / giorno',
      )}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {/* CSS selects the label before hydration, matching the saved theme immediately. */}
      <span className="theme-toggle-night">
        <Moon aria-hidden="true" />
        <span>
          <span className="sr-only">
            {pick(
              language,
              'Activează tema de ',
              'Switch to ',
              'Passer au thème ',
              'Wechseln zu ',
              'Cambiar a ',
              'Passa a ',
            )}
          </span>
          {pick(language, 'Noapte', 'Night', 'Nuit', 'Nacht', 'Noche', 'Notte')}
        </span>
      </span>
      <span className="theme-toggle-day">
        <Sun aria-hidden="true" />
        <span>
          <span className="sr-only">
            {pick(
              language,
              'Activează tema de ',
              'Switch to ',
              'Passer au thème ',
              'Wechseln zu ',
              'Cambiar a ',
              'Passa a ',
            )}
          </span>
          {pick(language, 'Zi', 'Day', 'Jour', 'Tag', 'Día', 'Giorno')}
        </span>
      </span>
    </Button>
  );
}
