'use client';
import { useEffect, useRef, useState } from 'react';
import { fetchBookText, textMatch, type BookPageText } from '@/lib/book-text';
import { bookTextSize } from '@/lib/book-reading';

type Props = { previewText?: BookPageText; fileId: string; page: number; pages: number; ro: boolean; size: number; onSizeChange: (size: number) => void; onGo: (page: number) => void; onRead: (page: number) => void };
export default function BookTextView({ previewText, fileId, page, pages, ro, size, onSizeChange, onGo, onRead }: Props) {
  const [query, setQuery] = useState(''), [searched, setSearched] = useState('');
  const [results, setResults] = useState<{ page: number; excerpt: string }[]>([]);
  const [busy, setBusy] = useState(false), [scanned, setScanned] = useState(0), [unavailable, setUnavailable] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const focusPage = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setSearched(term); setResults([]); setScanned(0); setUnavailable(0); setBusy(true);
    let count = 0;
    try {
      for (let number = 1; number <= pages && count < 100; number++) {
        if (abort.signal.aborted) break;
        try {
          const data = previewText?.page === number ? previewText : await fetchBookText(fileId, number, abort.signal);
          if (abort.signal.aborted) break;
          const index = textMatch(data.text, term);
          if (index >= 0) {
            count++;
            const start = Math.max(0, index - 60), end = Math.min(data.text.length, index + term.length + 100);
            setResults(old => [...old, { page: number, excerpt: `${start ? '…' : ''}${data.text.slice(start, end)}${end < data.text.length ? '…' : ''}` }]);
          }
          if (!data.text.trim()) setUnavailable(old => old + 1);
        } catch { if (!abort.signal.aborted) setUnavailable(old => old + 1); }
        if (!abort.signal.aborted) setScanned(number);
      }
    } finally { if (controller.current === abort) setBusy(false); }
  }
  return <div className="book-text-view">
    <div className="book-text-tools" role="group" aria-label={ro ? 'Dimensiunea textului' : 'Text size'}>
      <button className="secondary-button" type="button" onClick={() => onSizeChange(Math.max(bookTextSize.min, size - bookTextSize.step))} disabled={size <= bookTextSize.min} aria-label={ro ? 'Micșorează textul' : 'Decrease text size'}>A−</button>
      <span>{Math.round(size * 100)}%</span>
      <button className="secondary-button" type="button" onClick={() => onSizeChange(Math.min(bookTextSize.max, size + bookTextSize.step))} disabled={size >= bookTextSize.max} aria-label={ro ? 'Mărește textul' : 'Increase text size'}>A+</button>
    </div>
    <form className="book-text-search" onSubmit={search} role="search" aria-label={ro ? 'Caută în carte' : 'Search this book'}>
      <label>{ro ? 'Caută în textul cărții' : 'Search the book text'}<input type="search" minLength={2} maxLength={120} required value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button className="secondary-button" disabled={busy} type="submit">{ro ? 'Caută' : 'Search'}</button>
      {busy && <button className="secondary-button" type="button" onClick={() => { controller.current?.abort(); setBusy(false); }}>{ro ? 'Oprește căutarea' : 'Stop searching'}</button>}
    </form>
    {searched && <div className="book-text-results">
      <p role="status">{ro ? `${results.length} pagini găsite. ${scanned} din ${pages} pagini parcurse.${busy ? ' Căutarea continuă…' : scanned < pages ? ' Căutare incompletă.' : ''}${unavailable ? ` Text indisponibil pentru ${unavailable} pagini; rezultatele sunt incomplete.` : ''}` : `${results.length} matching pages. ${scanned} of ${pages} pages searched.${busy ? ' Searching…' : scanned < pages ? ' Search incomplete.' : ''}${unavailable ? ` Text unavailable for ${unavailable} pages; results are incomplete.` : ''}`}</p>
      {results.length >= 100 && <p>{ro ? 'Sunt afișate primele 100 de pagini găsite. Restrânge căutarea.' : 'Showing the first 100 matching pages. Refine your search.'}</p>}
      <ol>{results.map(result => <li key={result.page}><button type="button" className="book-text-result" onClick={() => { focusPage.current = true; onGo(result.page); if (result.page === page) document.getElementById('book-text-heading')?.focus(); }}><strong>{ro ? 'Pagina' : 'Page'} {result.page}</strong> — {result.excerpt}</button></li>)}</ol>
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
