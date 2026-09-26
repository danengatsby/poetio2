'use client';

/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation for the shared VPS/Sites header. */
import type { PoemLanguage } from '@/lib/poem-types';
import { siteCopy } from '@/lib/site-language';
import LanguageSelector from './language-selector';
import ThemeToggle from './theme-toggle';

export default function SiteHeader({ language, onLanguageChange, authorPage = false, videoPage = false, booksPage = false, poemPage = false }: {
  language: PoemLanguage; onLanguageChange: (language: PoemLanguage) => void; authorPage?: boolean; videoPage?: boolean; booksPage?: boolean; poemPage?: boolean;
}) {
  const copy = siteCopy[language];
  return <header className="site-header shell">
    <a href="/" className="wordmark" aria-label={copy.home}>Poetio<span aria-hidden="true">✳</span></a>
    <span className="header-note">{copy.note}</span>
    <nav className="header-nav" aria-label={copy.navigation}>
      <a className="admin-entry" href="/admin">{copy.administration}</a>
      <a className="nav-link" href={(authorPage || videoPage || booksPage || poemPage) ? '/#collection' : '#collection'} aria-current={poemPage ? 'page' : undefined}>{copy.poems}</a>
      <a className="nav-link" href="/video" aria-current={videoPage ? 'page' : undefined}>Video</a>
      <a className="nav-link" href="/carti" aria-current={booksPage ? 'page' : undefined}>{language === 'ro' ? 'Cărți' : 'Books'}</a>
      <a className="nav-link" href="/autor" aria-current={authorPage ? 'page' : undefined}>{copy.author}</a>
      <LanguageSelector language={language} onChange={onLanguageChange} />
      <ThemeToggle language={language} />
    </nav>
  </header>;
}
