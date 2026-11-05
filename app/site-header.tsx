'use client';

// Use document navigation for the shared VPS/Sites header.
import type { PoemLanguage } from '@/lib/poem-types';
import { siteCopy, withSiteLanguage } from '@/lib/site-language';
import LanguageSelector from './language-selector';
import ThemeToggle from './theme-toggle';
import { useEffect, useRef } from 'react';
import './site-header.css';

export default function SiteHeader({ language, onLanguageChange, authorPage = false, videoPage = false, booksPage = false, poemPage = false }: {
  language: PoemLanguage; onLanguageChange: (language: PoemLanguage) => void; authorPage?: boolean; videoPage?: boolean; booksPage?: boolean; poemPage?: boolean;
}) {
  const copy = siteCopy[language];
  const options = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !options.current?.contains(event.target)) options.current?.removeAttribute('open'); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <header className="site-header public-header shell" lang={language}>
    <a href={withSiteLanguage('/', language)} className="wordmark" aria-label={copy.home}>Poetio<span aria-hidden="true">✳</span></a>
    <span className="header-note">{copy.note}</span>
    <nav className="header-nav" aria-label={copy.navigation}>
      <a className="nav-link" href={(authorPage || videoPage || booksPage || poemPage) ? withSiteLanguage('/#collection', language) : '#collection'} aria-current={poemPage ? 'page' : undefined}>{copy.poems}</a>
      <a className="nav-link" href={withSiteLanguage('/video', language)} aria-current={videoPage ? 'page' : undefined}>Video</a>
      <a className="nav-link" href={withSiteLanguage('/carti', language)} aria-current={booksPage ? 'page' : undefined}>{language === 'ro' ? 'Cărți' : 'Books'}</a>
      <a className="nav-link" href={withSiteLanguage('/autor', language)} aria-current={authorPage ? 'page' : undefined}>{copy.author}</a>
    </nav>
    <LanguageSelector language={language} onChange={onLanguageChange} compact />
    <details className="site-options" ref={options} onKeyDown={event => { if (event.key === 'Escape' && options.current?.open) { event.preventDefault(); options.current.open = false; options.current.querySelector('summary')?.focus(); } }}>
      <summary>{language === 'ro' ? 'Opțiuni' : 'Options'}</summary>
      <div className="site-options-panel"><ThemeToggle language={language} /><a className="admin-entry" href="/admin">{copy.administration}</a></div>
    </details>
  </header>;
}
