'use client';
// GET navigation keeps the reading selection in the URL.
import { useEffect, useRef, useState } from 'react';
import { collectionHref, POEM_PAGE_SIZE, type PoemCollection } from '@/lib/poem-collection';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import { poemRecording } from '@/lib/poem-languages';
import PoemAudioPlayer from './poem-audio-player';
import PoemComments from './poem-comments';
import SiteLogo from './site-logo';
import SiteHeader from './site-header';
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
  const { poems, themes, filters, page, pages, total } = collection;
  const language = filters.language,
    copy = siteCopy[language];
  const filtered = Boolean(filters.q || filters.theme || filters.topic || filters.translation !== 'all');
  const reset = collectionHref({ ...filters, q: '', theme: '', topic: '', translation: 'all' });
  const [selectedId, setSelectedId] = useState(initialPoem);
  const selected = poems.find(poem => poem.id === selectedId) ?? poems[0];
  const recording = selected && poemRecording(selected, selected.language);
  useEffect(() => {
    const restore = () => setSelectedId(new URL(location.href).searchParams.get('poem') ?? undefined);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    const sync = () => {
      if (disclosure.current) disclosure.current.open = filtered || desktop.matches;
    };
    sync();
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, [filtered]);
  const searchLabel = pick(
    language,
    'Caută în colecție',
    'Search the collection',
    'Rechercher dans la collection',
    'Sammlung durchsuchen',
    'Buscar en la colección',
    'Cerca nella collezione',
  );
  function changeLanguage(value: SiteLanguage) {
    rememberSiteLanguage(value);
    window.location.assign(
      collectionHref(
        { ...filters, topic: '', theme: filters.topic || filters.theme, language: value },
        page,
        selectedId,
      ),
    );
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main id="main" lang={language}>
        {!filtered && page === 1 && poems.length > 0 && (
          <div className="collection-logo shell">
            <SiteLogo />
          </div>
        )}
        <section id="collection" className="collection shell" aria-label={copy.poems}>
          <details className="filter-disclosure" ref={disclosure} open={filtered}>
            <summary>{searchLabel}</summary>
            <form
              className="collection-filters"
              action="/#collection"
              method="get"
              role="search"
              aria-label={searchLabel}
            >
              <input type="hidden" name="lang" value={language} />
              <label>
                {pick(
                  language,
                  'Caută în titlu și text',
                  'Search titles and text',
                  'Rechercher dans les titres et les textes',
                  'Titel und Texte durchsuchen',
                  'Buscar en títulos y textos',
                  'Cerca nei titoli e nei testi',
                )}
                <input type="search" name="q" defaultValue={filters.q} maxLength={120} />
              </label>
              {filters.theme && <input type="hidden" name="theme" value={filters.theme} />}
              <label>
                {pick(language, 'Temă', 'Theme', 'Thème', 'Thema', 'Tema', 'Tema')}
                <select name="topic" defaultValue={filters.topic || filters.theme}>
                  <option value="">
                    {pick(
                      language,
                      'Toate temele',
                      'All themes',
                      'Tous les thèmes',
                      'Alle Themen',
                      'Todos los temas',
                      'Tutti i temi',
                    )}
                  </option>
                  {filters.theme && (
                    <option value={filters.theme} disabled>
                      {filters.theme}
                    </option>
                  )}
                  {filters.topic && !themes.some(theme => theme.key === filters.topic) && (
                    <option value={filters.topic}>{filters.topic} (0)</option>
                  )}
                  {themes.map(theme => (
                    <option key={theme.key} value={theme.key}>
                      {theme.label.normalize('NFC')} ({theme.count})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {pick(language, 'Traducere', 'Translation', 'Traduction', 'Übersetzung', 'Traducción', 'Traduzione')}
                <select name="translation" defaultValue={filters.translation}>
                  <option value="all">
                    {pick(
                      language,
                      'Toate poemele',
                      'All poems',
                      'Tous les poèmes',
                      'Alle Gedichte',
                      'Todos los poemas',
                      'Tutte le poesie',
                    )}
                  </option>
                  <option value="with">
                    {pick(
                      language,
                      'Cu traducere',
                      'With a translation',
                      'Avec traduction',
                      'Mit Übersetzung',
                      'Con traducción',
                      'Con traduzione',
                    )}
                  </option>
                  <option value="without">
                    {pick(
                      language,
                      'Fără traducere',
                      'Without a translation',
                      'Sans traduction',
                      'Ohne Übersetzung',
                      'Sin traducción',
                      'Senza traduzione',
                    )}
                  </option>
                </select>
              </label>
              <button type="submit" className="primary-button">
                {pick(language, 'Caută', 'Search', 'Rechercher', 'Suchen', 'Buscar', 'Cerca')}
              </button>
              {filtered && (
                <a className="collection-reset" href={reset}>
                  {pick(
                    language,
                    'Șterge filtrele',
                    'Clear filters',
                    'Effacer les filtres',
                    'Filter zurücksetzen',
                    'Borrar filtros',
                    'Azzera i filtri',
                  )}
                </a>
              )}
            </form>
          </details>
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
                <p className="collection-verses" lang={selected.language}>
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
                      'Niciun poem nu corespunde filtrelor. Încearcă alte cuvinte sau șterge filtrele.',
                      'No poems match these filters. Try other words or clear the filters.',
                      'Aucun poème ne correspond à ces filtres. Essayez d’autres mots ou effacez les filtres.',
                      'Keine Gedichte entsprechen diesen Filtern. Versuchen Sie andere Wörter oder setzen Sie die Filter zurück.',
                      'Ningún poema coincide con estos filtros. Prueba otras palabras o borra los filtros.',
                      'Nessuna poesia corrisponde a questi filtri. Prova altre parole o azzera i filtri.',
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
          {pages > 1 && (
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
                <a className="secondary-button" rel="prev" href={collectionHref(filters, page - 1)}>
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
                {pick(
                  language,
                  `Pagina ${page} din ${pages}`,
                  `Page ${page} of ${pages}`,
                  `Page ${page} sur ${pages}`,
                  `Seite ${page} von ${pages}`,
                  `Página ${page} de ${pages}`,
                  `Pagina ${page} di ${pages}`,
                )}
              </span>
              {page < pages && (
                <a className="secondary-button" rel="next" href={collectionHref(filters, page + 1)}>
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
          )}
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
