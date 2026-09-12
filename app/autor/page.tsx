import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SITE_LANGUAGE_COOKIE, siteLanguage } from '@/lib/site-language';
import AuthorProfile from './author-profile';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  return {
    title: language === 'ro' ? 'Dan Enache — Autor | Poetio' : 'Dan Enache — Author | Poetio',
    description: language === 'ro' ? 'Despre Poetio: fotografia și biografia completă a poetului Dan Enache.' : 'About Poetio: the portrait and complete biography of poet Dan Enache.',
  };
}

export default async function AuthorPage() {
  const language = siteLanguage((await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
  return <AuthorProfile initialLanguage={language} />;
}
