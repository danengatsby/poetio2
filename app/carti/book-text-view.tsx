'use client';
import { useEffect, useRef, useState } from 'react';
import { fetchBookText, fetchBookSearch, textMatch, type BookPageText, type BookSearchResult } from '@/lib/book-text';
import { bookTextSize } from '@/lib/book-reading';

type Props = { previewText?: BookPageText; fileId: string; page: number; pages: number; ro: boolean; size: number; onSizeChange: (size: number) => void; onGo: (page: number) => void; onRead: (page: number) => void };
export default function BookTextView({ previewText, fileId, page, ro, size, onSizeChange, onGo, onRead }: Props) {
  const [query, setQuery] = useState(''), [searched, setSearched] = useState('');
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [busy, setBusy] = useState(false), [searchFailed, setSearchFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const focusPage = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(term: string, offset = 0, retry = false) {
    term = term.trim();
    if (term.length < 2) return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setSearched(term); setResult(null); setBusy(true); setSearchFailed(false);
    try {
      // An unsaved editor preview searches only its own page and stays private.
      if (previewText) {
        const index = textMatch(previewText.text, term);
        setResult({ status: 'ready', pages: 1, scanned: 1, unavailable: 0, total: index >= 0 ? 1 : 0, offset: 0, hasMore: false,
          results: index >= 0 ? [{ page: previewText.page, excerpt: previewText.text.slice(Math.max(0, index - 60), index + term.length + 100) }] : [] });
        return;
      }
      do {
        const value = await fetchBookSearch(fileId, term, offset, abort.signal, retry);
        retry = false;
        if (abort.signal.aborted) return;
        setResult(value);
        if (value.status !== 'preparing') break;
        await new Promise<void>(resolve => {
          const timer = setTimeout(done, 1500);
          function done() { clearTimeout(timer); abort.signal.removeEventListener('abort', done); resolve(); }
          abort.signal.addEventListener('abort', done, { once: true });
          if (abort.signal.aborted) done();
        });
      } while (!abort.signal.aborted);
    } catch { if (!abort.signal.aborted) setSearchFailed(true); }
    finally { if (controller.current === abort) setBusy(false); }
  }
  return <div className="book-text-view">
    <div className="book-text-tools" role="group" aria-label={ro ? 'Dimensiunea textului' : 'Text size'}>
      <button className="secondary-button" type="button" onClick={() => onSizeChange(Math.max(bookTextSize.min, size - bookTextSize.step))} disabled={size <= bookTextSize.min} aria-label={ro ? 'Micșorează textul' : 'Decrease text size'}>A−</button>
      <span>{Math.round(size * 100)}%</span>
      <button className="secondary-button" type="button" onClick={() => onSizeChange(Math.min(bookTextSize.max, size + bookTextSize.step))} disabled={size >= bookTextSize.max} aria-label={ro ? 'Mărește textul' : 'Increase text size'}>A+</button>
    </div>
    <form className="book-text-search" onSubmit={event => { event.preventDefault(); void search(query); }} role="search" aria-label={ro ? 'Caută în carte' : 'Search this book'}>
      <label>{previewText ? (ro ? 'Caută în pagina previzualizată' : 'Search the previewed page') : (ro ? 'Caută în textul cărții' : 'Search the book text')}<input type="search" minLength={2} maxLength={120} required value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button className="secondary-button" disabled={busy} type="submit">{ro ? 'Caută' : 'Search'}</button>
      {busy && <button className="secondary-button" type="button" onClick={() => { controller.current?.abort(); setBusy(false); }}>{ro ? 'Oprește căutarea' : 'Stop searching'}</button>}
    </form>
    {searchFailed && <div role="alert"><p>{ro ? 'Căutarea nu poate fi încărcată momentan. Textul paginii rămâne disponibil.' : 'Search could not be loaded. You can still read the current page.'}</p><button type="button" className="secondary-button" onClick={() => void search(searched)}>{ro ? 'Reîncearcă' : 'Try again'}</button></div>}
    {searched && result && <div className="book-text-results">
      <p role="status">{result.status === 'preparing'
        ? (ro ? `Se pregătește căutarea: ${result.scanned} din ${result.pages} pagini. ${result.total} pagini găsite până acum.` : `Preparing search: ${result.scanned} of ${result.pages} pages. ${result.total} matching pages so far.`)
        : result.status === 'error'
          ? (ro ? 'Pregătirea căutării s-a întrerupt. Rezultatele sunt incomplete.' : 'Search preparation stopped. Results are incomplete.')
          : (ro ? `${result.total} pagini găsite.` : `${result.total} matching pages.`)}</p>
      {result.unavailable > 0 && <p>{ro ? `Text indisponibil pentru ${result.unavailable} pagini; rezultatele sunt incomplete.` : `Text unavailable for ${result.unavailable} pages; results are incomplete.`}</p>}
      {!busy && (result.unavailable > 0 || result.status === 'error') && <button type="button" className="secondary-button" onClick={() => void search(searched, 0, true)}>{ro ? 'Reîncearcă paginile indisponibile' : 'Retry unavailable pages'}</button>}
      <ol>{result.results.map(item => <li key={item.page}><button type="button" className="book-text-result" onClick={() => { focusPage.current = true; onGo(item.page); if (item.page === page) document.getElementById('book-text-heading')?.focus(); }}><strong>{ro ? 'Pagina' : 'Page'} {item.page}</strong> — {item.excerpt}</button></li>)}</ol>
      {(result.offset > 0 || result.hasMore) && <nav aria-label={ro ? 'Paginile rezultatelor' : 'Search result pages'}><button type="button" className="secondary-button" disabled={busy || result.offset === 0} onClick={() => void search(searched, Math.max(0, result.offset - 20))}>{ro ? 'Anterioarele' : 'Previous results'}</button><button type="button" className="secondary-button" disabled={busy || !result.hasMore} onClick={() => void search(searched, result.offset + 20)}>{ro ? 'Următoarele' : 'Next results'}</button></nav>}
    </div>}
    {previewText?.page === page ? <TextPageContent data={previewText} ro={ro} size={size} query={searched} /> : <TextPage key={`${fileId}:${page}`} fileId={fileId} page={page} ro={ro} size={size} query={searched} onRead={onRead} onReady={() => { if (focusPage.current) { document.getElementById('book-text-heading')?.focus(); focusPage.current = false; } }} />}
  </div>;
}

function TextPage({ fileId, page, ro, size, query, onRead, onReady }: { fileId: string; page: number; ro: boolean; size: number; query: string; onRead: (page: number) => void; onReady: () => void }) {
  const [data, setData] = useState<BookPageText | null>(null), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  const ready = useRef(onReady);
  useEffect(() => { ready.current = onReady; });
  useEffect(() => {
    const abort = new AbortController();
    fetchBookText(fileId, page, abort.signal).then(value => {
      if (abort.signal.aborted) return;
      setData(value); if (value.text.trim()) onRead(page);
      requestAnimationFrame(() => { if (!abort.signal.aborted) ready.current(); });
    }).catch(() => { if (!abort.signal.aborted) setFailed(true); });
    return () => abort.abort();
  }, [fileId, page, retry, onRead]);
  if (failed) return <div role="alert"><p>{ro ? 'Textul nu poate fi încărcat momentan. Reîncearcă sau consultă pagina originală.' : 'Text could not be loaded. Try again or use the original page.'}</p><button className="secondary-button" type="button" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>{ro ? 'Reîncearcă textul' : 'Retry text'}</button></div>;
  if (!data) return <p role="status">{ro ? 'Se pregătește textul paginii… Pentru scanări poate dura mai mult.' : 'Preparing page text… Scanned pages may take longer.'}</p>;
  return <TextPageContent data={data} ro={ro} size={size} query={query} />;
}
function TextPageContent({ data, ro, size, query }: { data: BookPageText; ro: boolean; size: number; query: string }) {
  const page = data.page;
  const index = query ? textMatch(data.text, query) : -1;
  return <article className="book-text-page" aria-labelledby="book-text-heading">
    <h3 id="book-text-heading" tabIndex={-1}>{ro ? 'Pagina' : 'Page'} {page}</h3>
    <p className="book-reader-note">{data.reviewed ? (ro ? 'Text verificat de administrator.' : 'Text reviewed by the administrator.') : data.source === 'edited' ? (ro ? 'Transcriere neverificată.' : 'Unreviewed transcription.') : data.source === 'ocr' ? (ro ? 'Text recunoscut automat din imagine, neverificat. Pot exista greșeli sau omisiuni.' : 'Unreviewed text recognized from the image. Errors or omissions may remain.') : (ro ? 'Text extras automat, neverificat. Ordinea de lectură poate necesita corectare.' : 'Unreviewed extracted text. Reading order may need correction.')}</p>
    {data.text ? <div className="book-readable-text" lang={data.language} dir="auto" style={{ fontSize: `${size}rem` }}>{index < 0 ? data.text : <>{data.text.slice(0, index)}<mark>{data.text.slice(index, index + query.length)}</mark>{data.text.slice(index + query.length)}</>}</div> : <p>{ro ? 'Nu s-a putut recunoaște text pe această pagină. Consultă originalul; pagina poate necesita transcriere sau descriere manuală.' : 'No text could be recognized on this page. Use the original; a manual transcription or description may be needed.'}</p>}
  </article>;
}
