import type { Metadata } from 'next';
import { requestLanguage } from '@/lib/request-language';
import AuthorProfile from './author-profile';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return {
    title: language === 'ro' ? 'Dan Enache — Autor | Poetio' : 'Dan Enache — Author | Poetio',
    description: language === 'ro' ? 'Despre Poetio: fotografia și biografia completă a poetului Dan Enache.' : 'About Poetio: the portrait and complete biography of poet Dan Enache.',
  };
}

export default async function AuthorPage() {
  const language = await requestLanguage();
  return <AuthorProfile initialLanguage={language} />;
}
