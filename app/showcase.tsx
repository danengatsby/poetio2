'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import type { Poem, PoemLanguage } from '@/lib/poem-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { POEM_LANGUAGES, poemVersion } from '@/lib/poem-languages';
import { SITE_LANGUAGE_COOKIE, siteCopy } from '@/lib/site-language';
import PoemCover from './poem-cover';
import ThemeToggle from './theme-toggle';
import LanguageSelector from './language-selector';
import AboutPoetio from './about-poetio';
import PoemAudioPlayer from './poem-audio-player';

const number = (n: number) => String(n).padStart(2, '0');
const lines = (content: string) => content.split('\n').filter(line => line.trim());

function displayedVersion(poem: Poem, language: PoemLanguage) {
  const version = poemVersion(poem, language);
  return { text: version ?? poem, language: version ? language : poem.source_language, fallback: !version };
}

export default function Showcase({ poems, canAdmin, initialLanguage = 'ro' }: { poems: Poem[]; canAdmin: boolean; initialLanguage?: PoemLanguage }) {
  const [active, setActive] = useState<number | null>(null);
  const [language, setLanguage] = useState<PoemLanguage>(initialLanguage);
  const reader = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const copy = siteCopy[language];
  const current = active === null ? null : poems[active];
  const originalLabel = (source: PoemLanguage) => source === 'ro' ? copy.originalRomanian : copy.originalEnglish;

  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    document.documentElement.lang = value;
    try {
      document.cookie = `${SITE_LANGUAGE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch { /* The selector remains usable if the browser blocks preference cookies. */ }
    if (reader.current) reader.current.scrollTop = 0;
  }
  function open(index: number, button: HTMLButtonElement) { trigger.current = button; setActive(index); }
  function navigate(delta: number) {
    setActive(index => Math.max(0, Math.min(poems.length - 1, (index ?? 0) + delta)));
    if (reader.current) reader.current.scrollTop = 0;
    requestAnimationFrame(() => title.current?.focus());
  }

  return <>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <header className="site-header shell">
      <a href="/" className="wordmark" aria-label={copy.home}>Poetio<span aria-hidden="true">✳</span></a>
      <span className="header-note">{copy.note}</span>
      <nav className="header-nav" aria-label={copy.navigation}>
        {canAdmin && <a className="admin-entry" href="/admin">{copy.administration}</a>}
        <a className="nav-link" href="#collection">{copy.poems} <span aria-hidden="true">↗</span></a>
        <LanguageSelector language={language} onChange={changeLanguage} />
        <ThemeToggle language={language} />
      </nav>
    </header>
    <main id="main">
      <section className="intro shell" aria-labelledby="page-title">
        <div className="intro-top"><p className="eyebrow">{copy.tagline}</p><p className="edition">{copy.edition}</p></div>
        <h1 id="page-title">{copy.intro} <em>{copy.pause}</em></h1>
      </section>
      <AboutPoetio language={language} portrait={{ src: '/assets/dan-enache.jpg', width: 960, height: 960 }} />
      <section id="collection" className="collection shell" aria-labelledby="collection-title">
        <div className="section-heading"><div><p className="eyebrow">{copy.takeTime}</p><h2 id="collection-title">{copy.collection}<span className="count">({number(poems.length)})</span></h2></div><p>{copy.slowly}</p></div>
        {poems.length ? <div className="poem-grid">{poems.map((poem, index) => {
          const display = displayedVersion(poem, language);
          const poemLines = lines(display.text.content);
          return <button key={poem.id} className="poem-card" onClick={e => open(index, e.currentTarget)} aria-label={copy.readBy(display.text.title, poem.author)}>
            <PoemCover key={poem.image_id || poem.id} poem={poem} className="card-cover" />
            <span className="card-meta"><span>{number(index + 1)}</span><span lang={display.text.theme ? display.language : language}>{display.text.theme || copy.poetry}</span></span>
            {display.fallback && <span className="original-language-note">{originalLabel(poem.source_language)}</span>}
            <h3 lang={display.language}>{display.text.title}</h3>
            <p lang={display.language}>{poemLines.slice(0, 2).join('\n')}</p>
            <span className="card-bottom"><span>{poem.author} · {copy.lineCount(poemLines.length)}</span><span aria-hidden="true">↗</span></span>
          </button>;
        })}</div> : <div className="collection-empty"><p>{copy.empty}</p>{canAdmin && <a href="/admin" className="primary-button">{copy.addFirst}</a>}</div>}
      </section>
      <div className="closing shell"><span aria-hidden="true">✳</span><p>{copy.closing}<br />{copy.closingFor} <em>{copy.unwritten}</em></p></div>
    </main>
    <footer className="site-footer shell"><a className="wordmark" href="/">Poetio<span aria-hidden="true">✳</span></a><p>{copy.count(poems.length)}. {copy.footer}</p><a className="back-top" href="#">{copy.back} <span aria-hidden="true">↑</span></a></footer>
    <Dialog open={active !== null} onOpenChange={value => { if (!value) setActive(null); }}>
      <DialogContent ref={reader} className="poetry-reader" lang={language} showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        {current && <Tabs value={language} onValueChange={value => { if (value === 'ro' || value === 'en-US') changeLanguage(value); }} className="reader-languages">
          <div className="reader-top">
            <span className="reader-brand">Poetio<span aria-hidden="true">✳</span></span>
            <TabsList className="poem-language-menu" aria-label={copy.poemLanguage}><TabsTrigger value="ro" lang="ro">Română</TabsTrigger><TabsTrigger value="en-US" lang="en-US">English (US)</TabsTrigger></TabsList>
            <ThemeToggle language={language} />
            <DialogClose className="reader-close" aria-label={copy.close}>×</DialogClose>
          </div>
          {POEM_LANGUAGES.map(locale => {
            const version = poemVersion(current, locale);
            const readerCopy = siteCopy[locale];
            return <TabsContent key={locale} value={locale} className="reader-language-panel" lang={locale}>
              <article className="reader-article">
                <DialogDescription className="eyebrow">{version?.theme || readerCopy.poetry}</DialogDescription>
                <DialogTitle ref={locale === language ? title : undefined} tabIndex={-1} className="reader-title" lang={version ? locale : current.source_language}>{version?.title || current.title}</DialogTitle>
                <p className="reader-author">{current.author}</p>
                {version && locale === language && <PoemAudioPlayer key={`${current.id}:${current.revision}:${locale}`} title={version.title} content={version.content} language={locale} />}
                {version ? <div className="reader-body saved-poem-text">{version.content}</div> : <div className="translation-missing"><p>{readerCopy.missing}</p><button className="secondary-button" onClick={() => changeLanguage(current.source_language)}>{readerCopy.readOriginal}</button>{canAdmin && <a href="/admin">{readerCopy.addTranslation}</a>}</div>}
              </article>
            </TabsContent>;
          })}
          <div className="reader-navigation"><button disabled={active === 0} onClick={() => navigate(-1)}>{copy.previous}</button><span aria-live="polite">{number((active ?? 0) + 1)} / {number(poems.length)}</span><button disabled={active === poems.length - 1} onClick={() => navigate(1)}>{copy.next}</button></div>
        </Tabs>}
      </DialogContent>
    </Dialog>
  </>;
}
