'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import type { PoemLanguage } from '@/lib/poem-types';

export default function ThemeToggle({ language = 'ro' }: { language?: PoemLanguage }) {
  const { resolvedTheme, setTheme } = useTheme();
  const romanian = language === 'ro';

  return <Button type="button" variant="outline" className="theme-toggle" lang={language} title={romanian ? 'Schimbă tema: noapte / zi' : 'Switch theme: night / day'} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
    {/* CSS selects the label before hydration, matching the saved theme immediately. */}
    <span className="theme-toggle-night"><Moon aria-hidden="true" /><span><span className="sr-only">{romanian ? 'Activează tema de ' : 'Switch to '}</span>{romanian ? 'Noapte' : 'Night'}</span></span>
    <span className="theme-toggle-day"><Sun aria-hidden="true" /><span><span className="sr-only">{romanian ? 'Activează tema de ' : 'Switch to '}</span>{romanian ? 'Zi' : 'Day'}</span></span>
  </Button>;
}
