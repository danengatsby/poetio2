import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SITE_LANGUAGE_COOKIE, siteLanguage } from '@/lib/site-language';
import ThemeProvider from './theme-provider';
import './globals.css';
import './showcase.css';
import './admin.css';
import './theme.css';
import './language.css';
export const metadata: Metadata = {
  title: 'Poetio — A place to pause',
  description: 'A collection of poems about light, memory, and the small things we almost miss. Step inside and stay for a poem.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  return <html lang={language} suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
