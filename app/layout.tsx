import type { Metadata } from 'next';
import { siteIntro } from '@/lib/content-metadata';
import { requestLanguage } from '@/lib/request-language';
import ThemeProvider from './theme-provider';
import VisitTracker from './visit-tracker';
import './globals.css';
import './showcase.css';
import './admin.css';
import './theme.css';
import './language.css';
export async function generateMetadata(): Promise<Metadata> {
  return {
    ...siteIntro[await requestLanguage()],
    // favicon.ico for crawlers and older browsers; the SVG wherever it is supported.
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = await requestLanguage();
  return (
    <html lang={language} suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <VisitTracker />
      </body>
    </html>
  );
}
