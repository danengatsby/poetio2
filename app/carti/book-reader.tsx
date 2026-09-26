'use client';
/* eslint-disable @next/next/no-img-element -- Serve the already rendered page without an image proxy. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, CornerDownLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { readingPages, readingPositionKey, restoredPage } from '@/lib/book-reading';

const phoneQuery = '(max-width: 760px), (pointer: coarse) and (max-height: 600px)';
function subscribeLayout(listener: () => void) {
  const media = window.matchMedia(phoneQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const layoutSnapshot = () => window.matchMedia(phoneQuery).matches ? 'single' : 'spread';
const serverLayout = () => 'unknown';

export default function BookReader({ fileId, title, language = 'ro' }: { fileId: string; title: string; language?: 'ro' | 'en-US' }) {
  return <Reader key={fileId} fileId={fileId} title={title} language={language} />;
}
function Reader({ fileId, title, language }: { fileId: string; title: string; language: 'ro' | 'en-US' }) {
  const ro = language === 'ro';
  const layout = useSyncExternalStore(subscribeLayout, layoutSnapshot, serverLayout);
  const single = layout === 'single';
  const [pages, setPages] = useState(0), [page, setPage] = useState(1), [input, setInput] = useState('1');
  const [retry, setRetry] = useState(0), [failed, setFailed] = useState(false), [loaded, setLoaded] = useState<number[]>([]), [imageFailed, setImageFailed] = useState(false);
  const [zoom, setZoom] = useState(false), [zoomPage, setZoomPage] = useState<number | null>(null);
  const [resumed, setResumed] = useState<number | null>(null), [memoryAvailable, setMemoryAvailable] = useState(true);
  const initialized = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  const visiblePages = layout === 'unknown' ? [] : readingPages(page, pages, single);
  const firstVisible = visiblePages[0] ?? 1, lastVisible = visiblePages.at(-1) ?? 1;
  const focusedZoom = zoomPage !== null && visiblePages.includes(zoomPage) ? zoomPage : null;
  const enlarged = zoom || focusedZoom !== null;

  function remember(number: number) {
    try {
      localStorage.setItem(readingPositionKey(fileId), JSON.stringify({ page: number }));
      setMemoryAvailable(true);
    } catch { setMemoryAvailable(false); }
  }
  function resetScroll() { requestAnimationFrame(() => viewport.current?.scrollTo({ left: 0, top: 0 })); }
  function togglePageZoom(number: number) {
    setZoom(false); setZoomPage(current => current === number ? null : number);
    setPage(number); setInput(String(number));
    if (loaded.includes(number)) remember(number);
    resetScroll();
  }
  function toggleZoom() {
    if (focusedZoom !== null) { setZoomPage(null); setZoom(false); }
    else { setZoomPage(null); setZoom(value => !value); }
    resetScroll();
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/book-pages/${fileId}`, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.pages) || data.pages < 1) throw new Error('Invalid pages');
      if (controller.signal.aborted) return;
      if (!initialized.current) {
        let saved = 1;
        try { saved = restoredPage(localStorage.getItem(readingPositionKey(fileId)), data.pages); }
        catch { setMemoryAvailable(false); }
        setPage(saved); setInput(String(saved)); setResumed(saved > 1 ? saved : null);
        initialized.current = true;
      }
      setPages(data.pages);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [fileId, retry]);

  function go(next: number) {
    if (!Number.isSafeInteger(next) || next < 1 || next > pages) { setInput(String(page)); return; }
    if (next === page) { setInput(String(page)); return; }
    setZoom(false); setZoomPage(null); resetScroll();
    setPage(next); setInput(String(next)); setImageFailed(false); setResumed(null);
    // Save only a page whose image has actually loaded. Failed navigation keeps
    // the previous bookmark, and metadata retries never reset it to page one.
    if (loaded.includes(next)) remember(next);
    if (single && frame.current && controls.current) {
      const top = frame.current.getBoundingClientRect().top;
      const toolbarHeight = controls.current.getBoundingClientRect().height;
      if (top < toolbarHeight || top > window.innerHeight / 2) frame.current.scrollIntoView({ block: 'start' });
    }
  }
  const previous = () => go(single ? page - 1 : Math.max(1, firstVisible - 2));
  const next = () => go(single ? page + 1 : firstVisible + 2);
  const previousLabel = ro ? (single ? 'Pagina anterioară' : 'Paginile anterioare') : (single ? 'Previous page' : 'Previous pages');
  const nextLabel = ro ? (single ? 'Pagina următoare' : 'Paginile următoare') : (single ? 'Next page' : 'Next pages');
  const zoomLabel = enlarged ? (ro ? 'Potrivește în pagină' : 'Fit to page') : (ro ? 'Mărește' : 'Zoom in');
  function navigation(position: 'top' | 'bottom') {
    return <nav ref={position === 'top' ? controls : undefined} className={`book-page-controls book-controls-${position}`} aria-label={ro ? `Navigare pagini ${position === 'top' ? 'sus' : 'jos'}` : `Page navigation ${position === 'top' ? 'top' : 'bottom'}`}>
      <button className="secondary-button" aria-label={previousLabel} title={previousLabel} disabled={firstVisible === 1} onClick={previous}><ArrowLeft size={18} aria-hidden="true" /><span className="book-control-text">{ro ? 'Înapoi' : 'Previous'}</span></button>
      <form onSubmit={event => { event.preventDefault(); go(Number(input)); if (single) event.currentTarget.querySelector('input')?.blur(); }}>
        <label><span className="sr-only">{ro ? 'Numărul paginii' : 'Page number'}</span><input aria-label={ro ? 'Numărul paginii' : 'Page number'} type="number" inputMode="numeric" enterKeyHint="go" min={1} max={pages} step={1} value={input} onChange={event => setInput(event.target.value)} onBlur={() => { if (!input.trim()) setInput(String(page)); }} /></label>
        <span className="book-page-total" aria-label={ro ? `${pages} pagini` : `${pages} pages`}>/ {pages}</span>
        <button className="secondary-button" type="submit" aria-label={ro ? 'Mergi la pagină' : 'Go to page'} title={ro ? 'Mergi la pagină' : 'Go to page'}><CornerDownLeft size={18} aria-hidden="true" /><span className="book-control-text">{ro ? 'Mergi' : 'Go'}</span></button>
      </form>
      <button className="secondary-button" aria-label={nextLabel} title={nextLabel} disabled={lastVisible === pages} onClick={next}><span className="book-control-text">{ro ? 'Înainte' : 'Next'}</span><ArrowRight size={18} aria-hidden="true" /></button>
      <button className="secondary-button" aria-label={zoomLabel} title={zoomLabel} aria-pressed={enlarged} onClick={toggleZoom}>{enlarged ? <ZoomOut size={18} aria-hidden="true" /> : <ZoomIn size={18} aria-hidden="true" />}<span className="book-control-text">{zoomLabel}</span></button>
    </nav>;
  }
  return <section className="book-reader protected-book-reader" data-layout={layout} aria-label={ro ? 'Citire carte' : 'Book reader'}>
    <p className="book-reader-note">{ro ? 'Poetio — doar pentru lectură' : 'Poetio — reading only'}</p>
    {failed || imageFailed ? <div role="alert"><p>{ro ? 'Pagina cărții nu poate fi încărcată. Reîncearcă.' : 'The book page could not be loaded. Try again.'}</p><button className="secondary-button" onClick={() => { setFailed(false); setImageFailed(false); setLoaded([]); setRetry(value => value + 1); }}>{ro ? 'Reîncearcă' : 'Try again'}</button></div> : null}
    {pages > 0 && layout !== 'unknown' && <>
      {navigation('top')}
      <p className="book-reader-note book-visible-pages" aria-live="polite">{ro ? `${visiblePages.length === 2 ? 'Paginile' : 'Pagina'} ${firstVisible}${lastVisible > firstVisible ? `–${lastVisible}` : ''} din ${pages}` : `${visiblePages.length === 2 ? 'Pages' : 'Page'} ${firstVisible}${lastVisible > firstVisible ? `–${lastVisible}` : ''} of ${pages}`}</p>
      <div ref={frame} className="book-page-frame">
        <button className="book-side-arrow book-side-previous" aria-label={previousLabel} disabled={firstVisible === 1} onClick={previous}><span aria-hidden="true">←</span></button>
        <div ref={viewport} className={`book-page-viewport${zoom ? ' book-page-zoom' : ''}${focusedZoom !== null ? ' book-page-single-zoom' : ''}`} tabIndex={0} aria-label={ro ? 'Pagina cărții; săgețile schimbă pagina, Escape închide mărirea' : 'Book page; arrow keys turn pages, Escape exits zoom'} onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === 'Escape' && enlarged) { event.preventDefault(); setZoom(false); setZoomPage(null); resetScroll(); }
          if (!enlarged && event.key === 'ArrowRight' && lastVisible < pages) { event.preventDefault(); next(); }
          if (!enlarged && event.key === 'ArrowLeft' && firstVisible > 1) { event.preventDefault(); previous(); }
        }}>
          <div className="book-page-spread">
            {visiblePages.map(number => <button key={`${number}:${retry}`} className="book-page-toggle" hidden={focusedZoom !== null && focusedZoom !== number} aria-pressed={focusedZoom === number} aria-label={focusedZoom === number ? (ro ? `Micșorează pagina ${number}` : `Zoom out page ${number}`) : (ro ? `Mărește pagina ${number}` : `Zoom in page ${number}`)} onClick={() => togglePageZoom(number)}>
              <img className="book-page-image" src={`/api/book-pages/${fileId}/${number}?v=${retry}`} alt={`${title} — ${ro ? 'pagina' : 'page'} ${number}`} onLoad={() => { setLoaded(previous => previous.includes(number) ? previous : [...previous, number]); if (number === page) remember(number); }} onError={() => setImageFailed(true)} />
            </button>)}
          </div>
        </div>
        <button className="book-side-arrow book-side-next" aria-label={nextLabel} disabled={lastVisible === pages} onClick={next}><span aria-hidden="true">→</span></button>
      </div>
      {navigation('bottom')}
      <p className="book-reader-note book-position-note" role="status">{!memoryAvailable ? (ro ? 'Poziția nu poate fi memorată în acest browser.' : 'This browser cannot save your reading position.') : resumed ? (ro ? `Lectura a fost reluată de la pagina ${resumed}. Poziția se păstrează în acest browser.` : `Reading resumed at page ${resumed}. Your position is saved in this browser.`) : (ro ? 'Poziția de lectură se păstrează în acest browser.' : 'Your reading position is saved in this browser.')}</p>
    </>}
    {!failed && !imageFailed && (!pages || !visiblePages.length || !visiblePages.every(number => loaded.includes(number))) && <p role="status">{ro ? 'Se încarcă paginile…' : 'Loading pages…'}</p>}
  </section>;
}
