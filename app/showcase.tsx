'use client';
// GET navigation keeps filters in the URL and loads full poems only on their individual pages.
import { contentPath } from '@/lib/content-metadata';
import { collectionHref, POEM_PAGE_SIZE, type PoemCollection } from '@/lib/poem-collection';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import { commentCountLabel } from '@/lib/poem-comments';
import SiteLogo from './site-logo';
import PoemCover from './poem-cover';
import SiteHeader from './site-header';
import './collection.css';
import LegalLinks from './legal-links';

const number = (n: number) => String(n).padStart(2, '0');

export default function Showcase({ collection, canAdmin }: { collection: PoemCollection; canAdmin: boolean }) {
  const { poems, filters, page, pages, total } = collection;
  const language = filters.language,
    copy = siteCopy[language];
  const filtered = Boolean(filters.q || filters.theme || filters.translation !== 'all');
  const reset = collectionHref({ ...filters, q: '', theme: '', translation: 'all' });
  function changeLanguage(value: SiteLanguage) {
    rememberSiteLanguage(value);
    window.location.assign(collectionHref({ ...filters, language: value }, page));
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} />
      <main id="main" lang={language}>
        <div className="intro shell">
          <div className="intro-top">
            <p className="eyebrow">{copy.tagline}</p>
            <p className="edition">{copy.edition}</p>
          </div>
          <SiteLogo />
        </div>
        <section id="collection" className="collection shell" aria-labelledby="collection-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{copy.takeTime}</p>
              <h1 id="collection-title">
                {copy.collection}
                <span className="count">({number(total)})</span>
              </h1>
            </div>
            <p>{copy.slowly}</p>
          </div>
          <form
            className="collection-filters"
            action="/#collection"
            method="get"
            role="search"
            aria-label={pick(
              language,
              'Caută în colecție',
              'Search the collection',
              'Rechercher dans la collection',
              'Sammlung durchsuchen',
              'Buscar en la colección',
              'Cerca nella collezione',
            )}
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
            <label>
              {pick(language, 'Temă', 'Theme', 'Thème', 'Thema', 'Tema', 'Tema')}
              <input
                name="theme"
                defaultValue={filters.theme}
                maxLength={80}
                placeholder={pick(
                  language,
                  'ex. natură',
                  'e.g. nature',
                  'ex. nature',
                  'z. B. Natur',
                  'p. ej. naturaleza',
                  'es. natura',
                )}
              />
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
          {poems.length ? (
            <div className="poem-grid">
              {poems.map((poem, index) => {
                const countLabel = commentCountLabel(poem.comment_count, language);
                const query = new URLSearchParams({ lang: language, returnTo: collectionHref(filters, page) });
                return (
                  <a
                    key={poem.id}
                    data-poem-id={poem.id}
                    className="poem-card"
                    href={contentPath('poem', poem.id) + '?' + query.toString()}
                    aria-label={`${copy.readBy(poem.title, poem.author)} · ${countLabel}`}
                  >
                    <PoemCover poem={poem} className="card-cover" />
                    <span className="card-meta">
                      <span>{number((page - 1) * POEM_PAGE_SIZE + index + 1)}</span>
                      <span lang={poem.theme ? poem.language : language}>{poem.theme || copy.poetry}</span>
                    </span>
                    {poem.language !== language && (
                      <span className="original-language-note">
                        {poem.source_language === 'ro' ? copy.originalRomanian : copy.originalEnglish}
                      </span>
                    )}
                    <h3 lang={poem.language}>{poem.title}</h3>
                    <p lang={poem.language}>{poem.excerpt}</p>
                    <span className="card-bottom">
                      <span>
                        {poem.author}
                        <span className="card-comment-count">{countLabel}</span>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </span>
                  </a>
                );
              })}
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
