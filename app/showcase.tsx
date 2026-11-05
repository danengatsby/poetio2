'use client';
// GET navigation keeps filters in the URL and loads full poems only on their individual pages.
import { contentPath } from '@/lib/content-metadata';
import { collectionHref, POEM_PAGE_SIZE, type PoemCollection } from '@/lib/poem-collection';
import type { PoemLanguage } from '@/lib/poem-types';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import { commentCountLabel } from '@/lib/poem-comments';
import SiteLogo from './site-logo';
import PoemCover from './poem-cover';
import SiteHeader from './site-header';
import './collection.css';

const number = (n: number) => String(n).padStart(2, '0');

export default function Showcase({ collection, canAdmin }: { collection: PoemCollection; canAdmin: boolean }) {
  const { poems, filters, page, pages, total } = collection;
  const language = filters.language, ro = language === 'ro', copy = siteCopy[language];
  const filtered = Boolean(filters.q || filters.theme || filters.translation !== 'all');
  const reset = collectionHref({ ...filters, q: '', theme: '', translation: 'all' });
  function changeLanguage(value: PoemLanguage) {
    rememberSiteLanguage(value);
    window.location.assign(collectionHref({ ...filters, language: value }, page));
  }
  return <>
    <a className="skip-link" href="#main">{copy.skip}</a>
    <SiteHeader language={language} onLanguageChange={changeLanguage} />
    <main id="main" lang={language}>
      <div className="intro shell">
        <div className="intro-top"><p className="eyebrow">{copy.tagline}</p><p className="edition">{copy.edition}</p></div>
        <SiteLogo />
      </div>
      <section id="collection" className="collection shell" aria-labelledby="collection-title">
        <div className="section-heading"><div><p className="eyebrow">{copy.takeTime}</p><h1 id="collection-title">{copy.collection}<span className="count">({number(total)})</span></h1></div><p>{copy.slowly}</p></div>
        <form className="collection-filters" action="/#collection" method="get" role="search" aria-label={ro ? 'Caută în colecție' : 'Search the collection'}>
          <input type="hidden" name="lang" value={language} />
          <label>{ro ? 'Caută în titlu și text' : 'Search titles and text'}<input type="search" name="q" defaultValue={filters.q} maxLength={120} /></label>
          <label>{ro ? 'Temă' : 'Theme'}<input name="theme" defaultValue={filters.theme} maxLength={80} placeholder={ro ? 'ex. natură' : 'e.g. nature'} /></label>
          <label>{ro ? 'Traducere' : 'Translation'}<select name="translation" defaultValue={filters.translation}>
            <option value="all">{ro ? 'Toate poemele' : 'All poems'}</option>
            <option value="with">{ro ? 'Cu traducere' : 'With a translation'}</option>
            <option value="without">{ro ? 'Fără traducere' : 'Without a translation'}</option>
          </select></label>
          <button type="submit" className="primary-button">{ro ? 'Caută' : 'Search'}</button>
          {filtered && <a className="collection-reset" href={reset}>{ro ? 'Șterge filtrele' : 'Clear filters'}</a>}
        </form>
        <p className="collection-results" role="status">{total ? (ro ? `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} din ${total} de poeme` : `${(page - 1) * POEM_PAGE_SIZE + 1}–${(page - 1) * POEM_PAGE_SIZE + poems.length} of ${total} poems`) : (ro ? '0 poeme' : '0 poems')}</p>
        {poems.length ? <div className="poem-grid">{poems.map((poem, index) => {
          const countLabel = commentCountLabel(poem.comment_count, language);
          const query = new URLSearchParams({ lang: language, returnTo: collectionHref(filters, page) });
          return <a key={poem.id} data-poem-id={poem.id} className="poem-card" href={contentPath('poem', poem.id) + '?' + query.toString()} aria-label={`${copy.readBy(poem.title, poem.author)} · ${countLabel}`}>
            <PoemCover poem={poem} className="card-cover" />
            <span className="card-meta"><span>{number((page - 1) * POEM_PAGE_SIZE + index + 1)}</span><span lang={poem.theme ? poem.language : language}>{poem.theme || copy.poetry}</span></span>
            {poem.language !== language && <span className="original-language-note">{poem.source_language === 'ro' ? copy.originalRomanian : copy.originalEnglish}</span>}
            <h3 lang={poem.language}>{poem.title}</h3><p lang={poem.language}>{poem.excerpt}</p>
            <span className="card-bottom"><span>{poem.author}<span className="card-comment-count">{countLabel}</span></span><span aria-hidden="true">↗</span></span>
          </a>;
        })}</div> : <div className="collection-empty"><p>{filtered ? (ro ? 'Niciun poem nu corespunde filtrelor. Încearcă alte cuvinte sau șterge filtrele.' : 'No poems match these filters. Try other words or clear the filters.') : copy.empty}</p>{canAdmin && !filtered && <a href="/admin" className="primary-button">{copy.addFirst}</a>}</div>}
        {pages > 1 && <nav className="collection-pagination" aria-label={ro ? 'Paginile colecției' : 'Collection pages'}>
          {page > 1 && <a className="secondary-button" rel="prev" href={collectionHref(filters, page - 1)}>{ro ? '← Pagina anterioară' : '← Previous page'}</a>}
          <span aria-current="page">{ro ? `Pagina ${page} din ${pages}` : `Page ${page} of ${pages}`}</span>
          {page < pages && <a className="secondary-button" rel="next" href={collectionHref(filters, page + 1)}>{ro ? 'Pagina următoare →' : 'Next page →'}</a>}
        </nav>}
      </section>
      <div className="closing shell"><span aria-hidden="true">✳</span><p>{copy.closing}<br />{copy.closingFor} <em>{copy.unwritten}</em></p></div>
    </main>
    <footer className="site-footer shell"><a className="wordmark" href={withSiteLanguage('/', language)}>Poetio<span aria-hidden="true">✳</span></a><p>{copy.count(total)}. {copy.footer}</p><a className="back-top" href="#">{copy.back} <span aria-hidden="true">↑</span></a></footer>
  </>;
}
