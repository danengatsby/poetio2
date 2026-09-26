'use client';
import Link from 'next/link';
import { contentPath } from '@/lib/content-metadata';
import './content-detail.css';
import SiteLogo from './site-logo';

import { useCallback, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import type { Poem, PoemLanguage, PoemWithCommentCount } from '@/lib/poem-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { POEM_LANGUAGES, poemVersion } from '@/lib/poem-languages';
import { rememberSiteLanguage, siteCopy } from '@/lib/site-language';
import PoemCover from './poem-cover';
import ThemeToggle from './theme-toggle';
import SiteHeader from './site-header';
import PoemAudioPlayer from './poem-audio-player';
import PoemComments from './poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import { audioField } from '@/lib/poem-audio';

const number = (n: number) => String(n).padStart(2, '0');
const lines = (content: string) => content.split('\n').filter(line => line.trim());

function displayedVersion(poem: Poem, language: PoemLanguage) {
  const version = poemVersion(poem, language);
  return { text: version ?? poem, language: version ? language : poem.source_language, fallback: !version };
}

export default function Showcase({ poems, canAdmin, initialLanguage = 'ro' }: { poems: PoemWithCommentCount[]; canAdmin: boolean; initialLanguage?: PoemLanguage }) {
  const [active, setActive] = useState<number | null>(null);
  const [language, setLanguage] = useState<PoemLanguage>(initialLanguage);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const updateCommentCount = useCallback((poemId: string, total: number) => {
    setCommentCounts(previous => previous[poemId] === total ? previous : { ...previous, [poemId]: total });
  }, []);
  const reader = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const copy = siteCopy[language];
  const current = active === null ? null : poems[active];
  const originalLabel = (source: PoemLanguage) => source === 'ro' ? copy.originalRomanian : copy.originalEnglish;

  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
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
    <SiteHeader language={language} onLanguageChange={changeLanguage} />
    <main id="main">
      <div className="intro shell">
        <div className="intro-top"><p className="eyebrow">{copy.tagline}</p><p className="edition">{copy.edition}</p></div>
        <SiteLogo />
      </div>
      <section id="collection" className="collection shell" aria-labelledby="collection-title">
        <div className="section-heading"><div><p className="eyebrow">{copy.takeTime}</p><h1 id="collection-title">{copy.collection}<span className="count">({number(poems.length)})</span></h1></div><p>{copy.slowly}</p></div>
        {poems.length ? <div className="poem-grid">{poems.map((poem, index) => {
          const display = displayedVersion(poem, language);
          const poemLines = lines(display.text.content);
          const countLabel = commentCountLabel(commentCounts[poem.id] ?? poem.comment_count, language);
          return <div key={poem.id} className="collection-item"><button className="poem-card" onClick={e => open(index, e.currentTarget)} aria-label={`${copy.readBy(display.text.title, poem.author)} · ${countLabel}`}>
            <PoemCover key={poem.image_id || poem.id} poem={poem} className="card-cover" />
            <span className="card-meta"><span>{number(index + 1)}</span><span lang={display.text.theme ? display.language : language}>{display.text.theme || copy.poetry}</span></span>
            {display.fallback && <span className="original-language-note">{originalLabel(poem.source_language)}</span>}
            <h3 lang={display.language}>{display.text.title}</h3>
            <p lang={display.language}>{poemLines.slice(0, 2).join('\n')}</p>
            <span className="card-bottom"><span>{poem.author} · {copy.lineCount(poemLines.length)}<span className="card-comment-count">{countLabel}</span></span><span aria-hidden="true">↗</span></span>
          </button><a className="content-page-link" href={contentPath('poem',poem.id)+(language==='en-US'?'?lang=en-US':'')}>{language==='ro'?'Pagina poemului ↗':'Poem page ↗'}</a></div>;
        })}</div> : <div className="collection-empty"><p>{copy.empty}</p>{canAdmin && <a href="/admin" className="primary-button">{copy.addFirst}</a>}</div>}
      </section>
      <div className="closing shell"><span aria-hidden="true">✳</span><p>{copy.closing}<br />{copy.closingFor} <em>{copy.unwritten}</em></p></div>
    </main>
    <footer className="site-footer shell"><Link className="wordmark" href="/" prefetch={false}>Poetio<span aria-hidden="true">✳</span></Link><p>{copy.count(poems.length)}. {copy.footer}</p><a className="back-top" href="#">{copy.back} <span aria-hidden="true">↑</span></a></footer>
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
                {locale === language && <PoemAudioPlayer key={`${current.id}:${current.revision}:${locale}`} audioId={current[audioField(locale)] ?? null} title={version?.title || current.title} language={locale} />}
                {version ? <div className="reader-body saved-poem-text">{version.content}</div> : <div className="translation-missing"><p>{readerCopy.missing}</p><button className="secondary-button" onClick={() => changeLanguage(current.source_language)}>{readerCopy.readOriginal}</button>{canAdmin && <a href="/admin">{readerCopy.addTranslation}</a>}</div>}
              </article>
            </TabsContent>;
          })}
          <a className="content-page-link" href={contentPath('poem',current.id)+(language==='en-US'?'?lang=en-US':'')}>{language==='ro'?'Deschide pagina poemului ↗':'Open poem page ↗'}</a>
          <PoemComments key={current.id} poemId={current.id} language={language} onCountChange={updateCommentCount} />
          <div className="reader-navigation"><button disabled={active === 0} onClick={() => navigate(-1)}>{copy.previous}</button><span aria-live="polite">{number((active ?? 0) + 1)} / {number(poems.length)}</span><button disabled={active === poems.length - 1} onClick={() => navigate(1)}>{copy.next}</button></div>
        </Tabs>}
      </DialogContent>
    </Dialog>
  </>;
}
