'use client';
// GET navigation keeps the reading selection in the URL.
import { useEffect, useState } from 'react';
import { collectionHref, collectionPageHref, POEM_PAGE_SIZE, type PoemCollection } from '@/lib/poem-collection';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import { poemRecording } from '@/lib/poem-languages';
import PoemAudioPlayer from './poem-audio-player';
import './poem-reading.css';
import usePoemReadingPreferences from './use-poem-reading-preferences';
import PoemComments from './poem-comments';
import SiteLogo from './site-logo';
import SiteHeader from './site-header';
import LanguageSelector from './language-selector';
import { poemHref } from '@/lib/content-metadata';
import './collection.css';
import LegalLinks from './legal-links';

export default function Showcase({
  collection,
  canAdmin,
  initialPoem,
}: {
  collection: PoemCollection;
  canAdmin: boolean;
  initialPoem?: string;
}) {
  const { poems, filters, page, pages, total } = collection;
  const language = filters.language,
    copy = siteCopy[language];
  const filtered = Boolean(filters.q || filters.theme || filters.topic || filters.translation !== 'all');
  const reset = collectionHref({ ...filters, q: '', theme: '', topic: '', translation: 'all' });
  const [selectedId, setSelectedId] = useState(initialPoem);
  const selected = poems.find(poem => poem.id === selectedId) ?? poems[0];
  const preferences = usePoemReadingPreferences();
  const recording = selected && poemRecording(selected, selected.language);
  useEffect(() => {
    const restore = () => setSelectedId(new URL(location.href).searchParams.get('poem') ?? undefined);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const pagination = pages > 1 && <CollectionPagination filters={filters} page={page} pages={pages} />;
  function changeLanguage(value: SiteLanguage, fromPoem = false) {
    rememberSiteLanguage(value);
    const nextFilters = { ...filters, topic: '', theme: filters.topic || filters.theme, language: value };
    if (fromPoem && selected) {
      // A translation filter may exclude this poem in the new language.
      const href =
        filters.translation === 'all'
          ? collectionPageHref(nextFilters, page, selected.id)
          : poemHref(selected.id, value, collectionHref(nextFilters, page, selected.id));
      window.location.assign(href + '#poem-language');
    } else {
      window.location.assign(collectionHref(nextFilters, page, selectedId));
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main id="main" lang={language}>
        {poems.length > 0 && (
          <div className="collection-logo shell">
            <SiteLogo />
          </div>
        )}
        <section id="collection" className="collection shell" aria-label={copy.poems}>
          <p className="collection-results" role="status">
            {total
              ? pick(
                  language,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} din ${total} de poeme`,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} of ${total} poems`,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} sur ${total} poèmes`,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} von ${total} Gedichten`,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} de ${total} poemas`,
                  `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} di ${total} poesie`,
                )
              : pick(language, '0 poeme', '0 poems', '0 poème', '0 Gedichte', '0 poemas', '0 poesie')}
          </p>
          {filtered && (
            <a className="collection-reset" href={reset}>
              {pick(
                language,
                'Vezi toate poemele',
                'View all poems',
                'Voir tous les poèmes',
                'Alle Gedichte anzeigen',
                'Ver todos los poemas',
                'Vedi tutte le poesie',
              )}
            </a>
          )}
          {pagination}
          {selected ? (
            <div className="collection-reader" id="collection-reader">
              <nav
                className="collection-titles"
                aria-label={pick(
                  language,
                  'Titlurile poemelor',
                  'Poem titles',
                  'Titres des poèmes',
                  'Gedichttitel',
                  'Títulos de los poemas',
                  'Titoli delle poesie',
                )}
              >
                {poems.map(poem => (
                  <a
                    className="poem-card"
                    data-poem-id={poem.id}
                    key={poem.id}
                    href={collectionHref(filters, page, poem.id)}
                    lang={poem.language}
                    aria-current={poem.id === selected.id ? 'true' : undefined}
                    aria-controls="selected-poem"
                    onClick={event => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                      event.preventDefault();
                      if (poem.id === selected.id) return;
                      window.history.pushState(window.history.state, '', event.currentTarget.href);
                      setSelectedId(poem.id);
                    }}
                  >
                    {poem.title}
                  </a>
                ))}
              </nav>
              <article
                key={selected.id}
                id="selected-poem"
                className="collection-detail"
                aria-labelledby="selected-poem-title"
                tabIndex={0}
              >
                <LanguageSelector language={language} onChange={value => changeLanguage(value, true)} compact forPoem />
                <div className="collection-poem-heading">
                  <h1 id="selected-poem-title" lang={selected.language}>
                    {selected.title}
                  </h1>
                  {recording?.id && (
                    <PoemAudioPlayer
                      compactControl
                      audioId={recording.id}
                      title={selected.title}
                      language={language}
                      recording={recording.language}
                    />
                  )}
                </div>
                <div className="collection-byline">
                  <span>{selected.author}</span>
                  {selected.theme && <span lang={selected.language}>{selected.theme}</span>}
                  {selected.language !== language && (
                    <span>{selected.source_language === 'ro' ? copy.originalRomanian : copy.originalEnglish}</span>
                  )}
                </div>
                <p
                  className="collection-verses poem-reading-text"
                  data-width={preferences.width}
                  style={{ fontSize: `${preferences.textSize}rem` }}
                  lang={selected.language}
                >
                  {selected.content}
                </p>
                <PoemComments poemId={selected.id} language={language} discussionFirst />
              </article>
            </div>
          ) : (
            <div className="collection-empty">
              <p>
                {filtered
                  ? pick(
                      language,
                      'Niciun poem nu corespunde filtrelor.',
                      'No poems match these filters.',
                      'Aucun poème ne correspond à ces filtres.',
                      'Keine Gedichte entsprechen diesen Filtern.',
                      'Ningún poema coincide con estos filtros.',
                      'Nessuna poesia corrisponde a questi filtri.',
                    )
                  : copy.empty}
              </p>
              {canAdmin && !filtered && (
                <a href="/admin" className="primary-button">
                  {copy.addFirst}
                </a>
              )}
            </div>
          )}
          {pagination}
        </section>
        <div className="closing shell">
          <span aria-hidden="true">✳</span>
          <p>
            {copy.closing}
            <br />
            {copy.closingFor} <em>{copy.unwritten}</em>
          </p>
        </div>
      </main>
      <footer className="site-footer shell">
        <a className="wordmark" href={withSiteLanguage('/', language)}>
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <p>
          {copy.count(total)}. {copy.footer} · <LegalLinks language={language} />
        </p>
        <a className="back-top" href="#">
          {copy.back} <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </>
  );
}

function CollectionPagination({ filters, page, pages }: Pick<PoemCollection, 'filters' | 'page' | 'pages'>) {
  const { language } = filters;
  return (
    <nav
      className="collection-pagination"
      aria-label={pick(
        language,
        'Paginile colecției',
        'Collection pages',
        'Pages de la collection',
        'Seiten der Sammlung',
        'Páginas de la colección',
        'Pagine della collezione',
      )}
    >
      {page > 1 && (
        <a className="secondary-button" rel="prev" href={collectionPageHref(filters, page - 1) + '#collection-reader'}>
          {pick(
            language,
            '← Pagina anterioară',
            '← Previous page',
            '← Page précédente',
            '← Vorherige Seite',
            '← Página anterior',
            '← Pagina precedente',
          )}
        </a>
      )}
      <span aria-current="page">
        <strong>
          {pick(language, 'Pagina', 'Page', 'Page', 'Seite', 'Página', 'Pagina')} {page}
        </strong>{' '}
        {pick(language, 'din', 'of', 'sur', 'von', 'de', 'di')} {pages}
      </span>
      {page < pages && (
        <a className="secondary-button" rel="next" href={collectionPageHref(filters, page + 1) + '#collection-reader'}>
          {pick(
            language,
            'Pagina următoare →',
            'Next page →',
            'Page suivante →',
            'Nächste Seite →',
            'Página siguiente →',
            'Pagina successiva →',
          )}
        </a>
      )}
    </nav>
  );
}
