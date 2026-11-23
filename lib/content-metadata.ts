import type { Metadata } from 'next';
import type { SiteLanguage } from './poem-types';
import { pick } from './site-language';
export const siteOrigin = 'https://poetio.cloud';
export const contentPath = (kind: 'poem' | 'video' | 'book', id: string) =>
  `${kind === 'poem' ? '/poeme' : kind === 'book' ? '/carti' : '/video'}/${encodeURIComponent(id)}`;
export function excerpt(text: string, fallback: string) {
  const plain = text.replace(/\s+/g, ' ').trim();
  return plain ? (plain.length > 157 ? plain.slice(0, 157).trimEnd() + '…' : plain) : fallback;
}
export function contentMetadata({
  title,
  author,
  description,
  path,
  image,
  language,
  updated,
  published,
  video,
  type = 'article',
}: {
  title: string;
  author: string;
  description: string;
  path: string;
  image: string;
  language: SiteLanguage;
  updated: number;
  published: number;
  video?: string;
  type?: 'article' | 'book';
}): Metadata {
  const url = siteOrigin + path;
  return {
    title: `${title} — ${author ? author + ' · ' : ''}Poetio`,
    description,
    authors: author ? [{ name: author }] : undefined,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Poetio',
      locale: pick(language, 'ro_RO', 'en_US', 'fr_FR', 'de_DE', 'es_ES', 'it_IT'),
      images: [{ url: siteOrigin + image, alt: title }],
      ...(video
        ? { type: 'video.other' as const, videos: [{ url: siteOrigin + video }] }
        : type === 'book'
          ? { type: 'book' as const }
          : {
              type: 'article' as const,
              publishedTime: new Date(published).toISOString(),
              modifiedTime: new Date(updated).toISOString(),
              authors: author ? [author] : undefined,
            }),
    },
    twitter: { card: 'summary_large_image', title, description, images: [siteOrigin + image] },
    robots: { index: true, follow: true },
  };
}
/** The site's own name and introduction: the home page and the default for every page. */
export const siteIntro = {
  ro: {
    title: 'Poetio — Un răgaz pentru tine',
    description:
      'O colecție de poeme despre lumină, amintiri și lucrurile mărunte pe care aproape le trecem cu vederea. Intră și rămâi pentru un poem.',
  },
  'en-US': {
    title: 'Poetio — A place to pause',
    description:
      'A collection of poems about light, memory, and the small things we almost miss. Step inside and stay for a poem.',
  },
  fr: {
    title: 'Poetio — Un instant de répit',
    description:
      'Une collection de poèmes sur la lumière, les souvenirs et les petites choses que l’on remarque à peine. Entrez et restez le temps d’un poème.',
  },
  de: {
    title: 'Poetio — Ein Moment zum Innehalten',
    description:
      'Eine Sammlung von Gedichten über Licht, Erinnerungen und die kleinen Dinge, die wir beinahe übersehen. Treten Sie ein und bleiben Sie für ein Gedicht.',
  },
  es: {
    title: 'Poetio — Un respiro para ti',
    description:
      'Una colección de poemas sobre la luz, los recuerdos y las pequeñas cosas que casi pasamos por alto. Entra y quédate el tiempo de un poema.',
  },
  it: {
    title: 'Poetio — Un momento di respiro',
    description:
      'Una collezione di poesie sulla luce, sui ricordi e sulle piccole cose che quasi non notiamo. Entra e resta il tempo di una poesia.',
  },
} as const;

/** The address of a page in a site language (Romanian has no parameter). */
export const languagePath = (path: string, language: SiteLanguage) =>
  path + pick(language, '', '?lang=en-US', '?lang=fr', '?lang=de', '?lang=es', '?lang=it');

/** Canonical address, language versions and sharing preview of a collection page (/, /carti, /video, /autor). */
export function pageMetadata({
  title,
  description,
  path,
  language,
  image = { url: '/assets/poetio-balloons.png', width: 2048, height: 683 },
}: {
  title: string;
  description: string;
  path: string;
  language: SiteLanguage;
  image?: { url: string; width: number; height: number };
}): Metadata {
  const url = (lang: SiteLanguage) => siteOrigin + languagePath(path, lang);
  return {
    title,
    description,
    alternates: {
      canonical: url(language),
      languages: {
        ro: url('ro'),
        'en-US': url('en-US'),
        fr: url('fr'),
        de: url('de'),
        es: url('es'),
        it: url('it'),
      },
    },
    openGraph: {
      title,
      description,
      url: url(language),
      siteName: 'Poetio',
      locale: pick(language, 'ro_RO', 'en_US', 'fr_FR', 'de_DE', 'es_ES', 'it_IT'),
      type: 'website',
      images: [{ ...image, url: siteOrigin + image.url, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [siteOrigin + image.url] },
  };
}

export const safeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
