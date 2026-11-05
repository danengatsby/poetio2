'use client';

// Use document navigation consistently with the shared header.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PoemLanguage } from '@/lib/poem-types';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import AboutPoetio from '../about-poetio';
import SiteHeader from '../site-header';
import { ReaderComments } from '../poem-comments';

export default function AuthorProfile({ initialLanguage }: { initialLanguage: PoemLanguage }) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const copy = siteCopy[language];

  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }

  return <>
    <a className="skip-link" href="#main">{language === 'ro' ? 'Mergi la biografie' : 'Skip to biography'}</a>
    <SiteHeader language={language} onLanguageChange={changeLanguage} authorPage />
    <main id="main" lang={language}>
      <section className="intro shell" aria-labelledby="page-title">
        <p className="eyebrow">{copy.author}</p>
        <h1 id="page-title">{language === 'ro' ? 'Despre Poetio' : 'About Poetio'}</h1>
      </section>
      <AboutPoetio language={language} portrait={{ src: '/assets/dan-enache.jpg', width: 960, height: 960 }} />
      <div className="about-comments shell">
        <ReaderComments endpoint="/api/about/comments" language={language} intro={language === 'ro' ? 'Lasă un gând despre Poetio și povestea autorului.' : 'Share a thought about Poetio and the author’s story.'} />
      </div>
    </main>
    <footer className="site-footer shell">
      <a className="wordmark" href={withSiteLanguage('/', language)}>Poetio<span aria-hidden="true">✳</span></a>
      <p>{copy.footer}</p>
      <a className="back-top" href="#">{copy.back} <span aria-hidden="true">↑</span></a>
    </footer>
  </>;
}
