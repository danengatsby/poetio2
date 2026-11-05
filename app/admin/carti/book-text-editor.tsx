'use client';
/* eslint-disable @next/next/no-img-element -- Compare against the same server-rendered page as the public reader. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_PAGE_TEXT, type BookPageText } from '@/lib/book-text';
import type { BookTextSnapshot } from '@/lib/book-text-recovery';
import BookTextRecovery from './book-text-recovery';

export default function BookTextEditor({ fileId, disabled, onDirtyChange, onPreviewChange }: { fileId: string; disabled: boolean; onDirtyChange: (dirty: boolean) => void; onPreviewChange: (value: { fileId: string; data: BookPageText } | null) => void }) {
  const [page, setPage] = useState(1), [pages, setPages] = useState(0);
  const [data, setData] = useState<BookPageText | null>(null);
  const [text, setText] = useState(''), [language, setLanguage] = useState<BookPageText['language']>('und');
  const [checked, setChecked] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [request, setRequest] = useState({ version: 0, mode: 'auto' });
  const saving = useRef(false);
  const abortSave = useRef<AbortController | null>(null);
  const recovery = useRef<BookTextSnapshot | null>(null);
  const dirty = !!data && (text !== data.text || language !== data.language);
  const snapshot = useMemo(() => data ? { fileId, page, text, language, revision: data.revision } : null, [data, fileId, page, text, language]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    onPreviewChange(data && !busy ? { fileId, data: { ...data, text, language, reviewed: checked || (!dirty && data.reviewed), source: dirty ? 'edited' : data.source } } : null);
    return () => onPreviewChange(null);
  }, [fileId, data, text, language, checked, dirty, busy, onPreviewChange]);
  useEffect(() => () => abortSave.current?.abort(), []);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setBusy(true); setError(''); setSuccess(''); setChecked(false);
      try {
        const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(120000)]);
        const metadata = await fetch(`/api/book-pages/${fileId}`, { signal, cache: 'no-store' });
        if (!metadata.ok) throw new Error('Numărul paginilor nu poate fi încărcat.');
        const info = await metadata.json();
        if (abort.signal.aborted) return;
        setPages(info.pages);
        const recovered = recovery.current;
        const suffix = recovered || request.mode === 'manual' ? '?manual=1' : request.mode === 'ocr' ? '?ocr=1' : '';
        const response = await fetch(`/api/admin/book-text/${fileId}/${page}${suffix}`, { signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Textul nu poate fi încărcat.');
        if (abort.signal.aborted) return;
        setData(result);
        if (recovered && recovered.fileId === fileId && recovered.page === page) {
          setText(recovered.text); setLanguage(recovered.language); recovery.current = null;
          setSuccess('Versiunea este în editor. Compar-o cu originalul și confirmă verificarea pentru a publica.');
        } else { setText(result.text); setLanguage(result.language); }
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Textul nu poate fi încărcat.');
      } finally { if (!abort.signal.aborted) setBusy(false); }
    }
    void load();
    return () => abort.abort();
  }, [fileId, page, request]);
  function guard() { return !busy && !disabled && (!dirty || window.confirm('Ai corecturi nepublicate. Continui cu încărcarea altui text? Verifică starea schiței pentru recuperare.')); }
  function turn(number: number) {
    if (!guard()) return;
    setData(null); setText(''); setPage(number); setRequest(value => ({ version: value.version + 1, mode: 'auto' }));
  }
  function reload(mode: string) {
    if (guard()) { recovery.current = null; setRequest(value => ({ version: value.version + 1, mode })); }
  }
  function recover(value: BookTextSnapshot) {
    if (value.fileId !== fileId || value.page > pages || !guard()) return;
    recovery.current = value; setData(null); setText(''); setPage(value.page); setRequest(request => ({ version: request.version + 1, mode: 'manual' }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!data || saving.current || !checked) return;
    saving.current = true; setBusy(true); setError(''); setSuccess('');
    const abort = new AbortController(); abortSave.current = abort;
    try {
      const response = await fetch(`/api/admin/book-text/${fileId}/${page}`, { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language, revision: data.revision, reviewed: checked }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Salvarea nu a reușit. Textul introdus a fost păstrat.');
      if (abort.signal.aborted) return;
      setData(result); setText(result.text); setLanguage(result.language); setSuccess('Text verificat și salvat. Devine accesibil cititorilor dacă acest PDF este legat de o carte publicată.');
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Salvarea nu a reușit. Textul introdus a fost păstrat.'); }
    finally { saving.current = false; if (!abort.signal.aborted) setBusy(false); }
  }
  return <section className="book-text-editor" aria-label="Verificarea textului cărții">
    <h2>Text pentru lectură accesibilă</h2>
    <p>Compară textul cu pagina originală. Corectează ordinea coloanelor, versurile și diacriticele; descrie imaginile relevante. Pentru o pagină albă poți scrie „Pagină fără conținut”. Corecturile se salvează separat de detaliile cărții.</p>
    <div className="book-text-tools">
      <button type="button" className="secondary-button" disabled={busy || disabled || page <= 1} onClick={() => turn(page - 1)}>Pagina anterioară</button>
      <label>Pagina textului <input type="number" min={1} max={pages || 1} value={page} disabled={busy || disabled || !pages} onChange={event => { const number = Number(event.target.value); if (Number.isInteger(number) && number >= 1 && number <= pages) turn(number); }} /></label>
      <span>din {pages || '…'}</span>
      <button type="button" className="secondary-button" disabled={busy || disabled || page >= pages} onClick={() => turn(page + 1)}>Pagina următoare</button>
    </div>
    {busy && <p role="status">Se procesează textul…</p>}
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    <BookTextRecovery key={`${fileId}:${page}`} fileId={fileId} page={page} snapshot={snapshot} dirty={dirty} disabled={busy || disabled} onRecover={recover} />
    <div className="book-text-tools">
      <button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => reload('auto')}>Reîncarcă textul salvat</button>
      <button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => reload('ocr')}>Recunoaște textul din imagine (OCR)</button>
      <button type="button" className="secondary-button" disabled={busy || disabled} onClick={() => reload('manual')}>Transcriere manuală</button>
    </div>
    <div className="book-text-compare">
      <img src={`/api/book-pages/${fileId}/${page}`} alt={`Pagina originală ${page}, pentru verificarea transcrierii`} />
      <form onSubmit={save}>
        <fieldset disabled={busy || disabled || !data}>
          <legend>Textul paginii {page}</legend>
          {data && <p>{data.reviewed ? 'Versiune verificată.' : data.source === 'ocr' ? 'Propunere OCR neverificată.' : 'Text neverificat.'}</p>}
          <label>Limba textului<select value={language} onChange={event => { setLanguage(event.target.value as BookPageText['language']); setChecked(false); }}><option value="und">Nespecificată / mai multe limbi</option><option value="ro">Română</option><option value="en-US">English (US)</option></select></label>
          <label>Transcriere sau descriere<textarea rows={20} required maxLength={MAX_PAGE_TEXT} value={text} onChange={event => { setText(event.target.value); setChecked(false); setSuccess(''); }} /></label>
          <label className="book-text-confirm"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />Am verificat conținutul și ordinea de lectură față de pagina originală.</label>
          <button className="primary-button" type="submit" disabled={!checked || !text.trim()}>Salvează textul verificat</button>
        </fieldset>
      </form>
    </div>
  </section>;
}
