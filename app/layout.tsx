import type { Metadata } from 'next';
import { requestLanguage } from '@/lib/request-language';
import ThemeProvider from './theme-provider';
import './globals.css';
import './showcase.css';
import './admin.css';
import './theme.css';
import './language.css';
export async function generateMetadata(): Promise<Metadata> {
  const ro = await requestLanguage() === 'ro';
  return {
    title: ro ? 'Poetio — Un răgaz pentru tine' : 'Poetio — A place to pause',
    description: ro ? 'O colecție de poeme despre lumină, amintiri și lucrurile mărunte pe care aproape le trecem cu vederea. Intră și rămâi pentru un poem.' : 'A collection of poems about light, memory, and the small things we almost miss. Step inside and stay for a poem.',
    icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = await requestLanguage();
  return <html lang={language} suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
