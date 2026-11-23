import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/content-metadata';
import { requestLanguage } from '@/lib/request-language';
import AuthorProfile from './author-profile';
import { pick } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const language = await requestLanguage();
  return pageMetadata({
    title: pick(
      language,
      'Dan Enache — Autor | Poetio',
      'Dan Enache — Author | Poetio',
      'Dan Enache — Auteur | Poetio',
      'Dan Enache — Autor | Poetio',
    ),
    description: pick(
      language,
      'Despre Poetio: fotografia și biografia completă a poetului Dan Enache.',
      'About Poetio: the portrait and complete biography of poet Dan Enache.',
      'À propos de Poetio\u00a0: le portrait et la biographie complète du poète Dan Enache.',
      'Über Poetio: das Porträt und die vollständige Biografie des Dichters Dan Enache.',
    ),
    path: '/autor',
    language,
    image: { url: '/assets/dan-enache.jpg', width: 960, height: 960 },
  });
}

export default async function AuthorPage() {
  const language = await requestLanguage();
  return <AuthorProfile initialLanguage={language} />;
}
