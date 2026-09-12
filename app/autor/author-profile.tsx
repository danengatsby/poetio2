'use client';

/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation consistently with the shared header. */
import { useState } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import { SITE_LANGUAGE_COOKIE, siteCopy } from '@/lib/site-language';
import AboutPoetio from '../about-poetio';
import SiteHeader from '../site-header';

export default function AuthorProfile({ initialLanguage }: { initialLanguage: PoemLanguage }) {
  const [language, setLanguage] = useState(initialLanguage);
  const copy = siteCopy[language];

  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    document.documentElement.lang = value;
    try {
      document.cookie = `${SITE_LANGUAGE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch { /* Reading remains available when preference cookies are blocked. */ }
  }

  return <>
    <a className="skip-link" href="#main">{language === 'ro' ? 'Mergi la biografie' : 'Skip to biography'}</a>
    <SiteHeader language={language} onLanguageChange={changeLanguage} authorPage />
    <main id="main">
      <section className="intro shell" aria-labelledby="page-title">
        <p className="eyebrow">{copy.author}</p>
        <h1 id="page-title">{language === 'ro' ? 'Despre Poetio' : 'About Poetio'}</h1>
      </section>
      <AboutPoetio language={language} portrait={{ src: '/assets/dan-enache.jpg', width: 960, height: 960 }} />
    </main>
    <footer className="site-footer shell">
      <a className="wordmark" href="/">Poetio<span aria-hidden="true">✳</span></a>
      <p>{copy.footer}</p>
      <a className="back-top" href="#">{copy.back} <span aria-hidden="true">↑</span></a>
    </footer>
  </>;
}
