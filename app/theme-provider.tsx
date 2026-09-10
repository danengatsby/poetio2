'use client';

import type { ReactNode } from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return <NextThemeProvider attribute="class" storageKey="poetio-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>{children}</NextThemeProvider>;
}
