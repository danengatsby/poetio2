'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation with the existing administration. */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import RecoveryTools from '../recovery-tools';
import type { EditorSnapshot } from '@/lib/editorial';
import { MAX_BOOK_BYTES, BOOK_ACCEPT, bookFileType, type Book, type BookValidation } from '@/lib/book-types';
import ThemeToggle from '../../theme-toggle';
import BookPresentation from '../../carti/book-presentation';
import ReaderPreview from '../reader-preview';
import type { BookPageText } from '@/lib/book-text';
import BookTextEditor from './book-text-editor';
import Image from 'next/image';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/poem-images';
import '../../video/video.css';
import '../../carti/books.css';

type Draft = Pick<Book, 'id' | 'title' | 'author' | 'description' | 'file_id' | 'image_id' | 'revision'> & { isNew: boolean };
const fromBook = (book: Book): Draft => ({ id: book.id, title: book.title, author: book.author, description: book.description, file_id: book.file_id, image_id: book.image_id, revision: book.revision, isNew: false });
const blank = (): Draft => ({ id: crypto.randomUUID(), title: '', author: '', description: '', file_id: '', image_id: null, revision: 1, isNew: true });
class RequestError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(response.status, data?.error || (response.status === 401 ? 'Autentifică-te din nou. Datele introduse au fost păstrate.' : 'Cererea nu a reușit. Reîncearcă; datele introduse au fost păstrate.'));
  if (!data) throw new Error('Răspunsul nu poate fi citit. Reîncearcă salvarea.');
  return data;
}

type Selected = { file: File; id: string; url: string };
export default function BookAdmin({ initialBooks, initialError, signInHref }: { initialBooks: Book[]; initialError: boolean; signInHref: string }) {
  const [books, setBooks] = useState(initialBooks);
  const [draft, setDraft] = useState<Draft | null>(initialBooks[0] ? fromBook(initialBooks[0]) : null);
  const [baseline, setBaseline] = useState(draft);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [cover, setCover] = useState<Selected | null>(null);
  const [available, setAvailable] = useState(!initialError);
  const [busy, setBusy] = useState(false);
  const [previewText, setPreviewText] = useState<{ fileId: string; data: BookPageText } | null>(null);
  const [textDirty, setTextDirty] = useState(false);
  const [textEditorVersion, setTextEditorVersion] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [validation, setValidation] = useState<BookValidation | null>(null);
  const [error, setError] = useState(initialError ? 'Cărțile nu pot fi încărcate momentan. Reîncarcă lista.' : '');
  const [success, setSuccess] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const upload = useRef<XMLHttpRequest | null>(null);
  const validationRequest = useRef<AbortController | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [uploadedCoverId, setUploadedCoverId] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState({ pdf: false, cover: false });
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const bookDirty = JSON.stringify(draft) !== JSON.stringify(baseline) || selected !== null || cover !== null || missingFiles.pdf || missingFiles.cover;
  const dirty = bookDirty || textDirty;
  const pendingPdf = selected ? uploadedId !== selected.id : missingFiles.pdf;
  const pendingCover = cover ? uploadedCoverId !== cover.id : missingFiles.cover;
  const previewFileId = selected ? (uploadedId === selected.id && validation?.status === 'ready' ? uploadedId : '') : missingFiles.pdf ? '' : draft?.file_id || '';
  const recoveryDraft = useMemo(() => draft ? {
    ...draft,
    file_id: selected && uploadedId === selected.id ? uploadedId : draft.file_id,
    image_id: cover && uploadedCoverId === cover.id ? uploadedCoverId : draft.image_id,
    pendingBookFile: pendingPdf, pendingCover,
  } : null, [draft, selected, cover, uploadedId, uploadedCoverId, pendingPdf, pendingCover]);
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  useEffect(() => () => { upload.current?.abort(); validationRequest.current?.abort(); }, []);
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.url); }, [cover]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  function report(error: unknown) { setError(error instanceof Error ? error.message : 'Operația nu a reușit. Reîncearcă.'); setAuthRequired(error instanceof RequestError && error.status === 401); }
  function replace(value: Draft | null, resetText = true) {
    if (resetText) setTextEditorVersion(value => value + 1);
    setDraft(value); setBaseline(value); setSelected(null); setCover(null); setUploadedId(null); setUploadedCoverId(null); setMissingFiles({ pdf: false, cover: false });
    setError(''); setSuccess(''); setAuthRequired(false); setProgress(null); setValidation(null);
    if (input.current) input.current.value = '';
    requestAnimationFrame(() => title.current?.focus());
  }
  function guard(action: () => void) {
    if (locked.current) return;
    if (dirty && !window.confirm('Ai modificări nesalvate. Renunți la ele?')) return;
    action();
  }
  function choose(file: File | undefined) {
    if (!file || locked.current) return;
    if (textDirty && !window.confirm('Ai corecturi de text nesalvate. Renunți la ele pentru a înlocui PDF-ul?')) return;
    setError(''); setSuccess('');
    if (!bookFileType(file)) { setError('Alege un fișier PDF.'); return; }
    if (!file.size || file.size > MAX_BOOK_BYTES) { setError('Alege un fișier PDF de maximum 100 MB, care nu este gol.'); return; }
    setSelected({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) });
    setValidation(null);
    setUploadedId(null);
    if (input.current) input.current.value = '';
  }
  function uploadFile(file: Selected): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); upload.current = xhr;
      xhr.open('POST', '/api/book-files'); xhr.timeout = 10 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', bookFileType(file.file) || 'application/octet-stream');
      xhr.setRequestHeader('X-Upload-Id', file.id); xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.file.name));
      xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => {
        upload.current = null;
        let data; try { data = JSON.parse(xhr.responseText); } catch { /* Use the HTTP status fallback. */ }
        if (xhr.status < 200 || xhr.status >= 300) { reject(new RequestError(xhr.status, data?.error || (xhr.status === 401 ? 'Autentifică-te din nou. Fișierul selectat a fost păstrat.' : 'Încărcarea nu a reușit. Reîncearcă.'))); return; }
        if (!data?.file?.id) { reject(new Error('Încărcarea nu a fost confirmată. Reîncearcă.')); return; }
        resolve(data.file.id);
      };
      xhr.onerror = () => { upload.current = null; reject(new Error('Conexiunea s-a întrerupt. Fișierul selectat a fost păstrat; reîncearcă.')); };
      xhr.ontimeout = () => { upload.current = null; reject(new Error('Încărcarea a durat prea mult. Reîncearcă.')); };
      xhr.onabort = () => { upload.current = null; reject(new Error('Încărcarea a fost anulată. Fișierul selectat a fost păstrat.')); };
      xhr.send(file.file);
    });
  }
  async function verifyPages(fileId: string) {
    const controller = new AbortController();
    validationRequest.current = controller;
    const deadline = Date.now() + 15 * 60 * 1000;
    setValidation({ status: 'checking', pages: 0, checkedPages: 0 });
    let retry = true;
    try {
      for (;;) {
        const data = await request(`/api/book-files/${fileId}/validation`, { method: 'POST', body: JSON.stringify({ retry }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        retry = false;
        const state = data.validation as BookValidation;
        setValidation(state);
        if (state.status === 'ready') return;
        if (state.status === 'error') throw new RequestError(422, state.error || 'PDF-ul nu poate fi citit. Exportă din nou documentul și încarcă-l.');
        if (Date.now() >= deadline) throw new Error('Verificarea durează mai mult. Reîncearcă salvarea pentru a verifica progresul; datele introduse sunt păstrate.');
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(new Error('Verificarea continuă pe server. Reîncearcă salvarea când dorești; datele introduse sunt păstrate.')); };
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', cancel); resolve(); }, 1500);
          controller.signal.addEventListener('abort', cancel, { once: true });
          if (controller.signal.aborted) cancel();
        });
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Salvarea a fost anulată. Datele introduse sunt păstrate; verificarea PDF-ului poate continua pe server.');
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('Serverul nu a răspuns la timp. Reîncearcă salvarea; datele introduse sunt păstrate.');
      throw error;
    } finally { validationRequest.current = null; }
  }
  async function preparePreview() {
    if (!selected || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setSuccess('');
    try {
      const id = uploadedId === selected.id ? uploadedId : await uploadFile(selected);
      setUploadedId(id); setProgress(null);
      await verifyPages(id);
      setSuccess('PDF pregătit privat. Verifică paginile și transcrierea cu „Previzualizare ca cititor”, apoi salvează cartea când este gata.');
    } catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); setProgress(null); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || locked.current) return;
    if ((!selected && missingFiles.pdf) || (!cover && missingFiles.cover)) { setError('Schița avea fișiere neîncărcate. Selectează-le din nou sau alege explicit păstrarea referințelor recuperate.'); return; }
    if (!selected && !draft.file_id) { setError('Alege un fișier PDF.'); return; }
    locked.current = true; setBusy(true); setError(''); setSuccess(''); setAuthRequired(false); setValidation(null);
    try {
      let fileId = draft.file_id;
      if (selected) {
        if (uploadedId !== selected.id) { setProgress(0); fileId = await uploadFile(selected); setUploadedId(fileId); }
        else fileId = uploadedId;
      }
      setProgress(null);
      await verifyPages(fileId);
      let imageId = draft.image_id;
      if (cover && uploadedCoverId === cover.id) imageId = uploadedCoverId;
      else if (cover) {
        const response = await fetch('/api/images', { method: 'POST', headers: { 'Content-Type': cover.file.type, 'X-Upload-Id': cover.id, 'X-File-Name': encodeURIComponent(cover.file.name) }, body: cover.file });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.image?.id) throw new RequestError(response.status, result?.error || 'Coperta nu a putut fi încărcată. Reîncearcă.');
        imageId = result.image.id;
        setUploadedCoverId(imageId);
      }
      setProgress(null);
      const data = await request(draft.isNew ? '/api/books' : `/api/books/${draft.id}`, { method: draft.isNew ? 'POST' : 'PUT', body: JSON.stringify({ ...draft, file_id: fileId, image_id: imageId }) });
      const saved = data.book as Book;
      setBooks(current => [saved, ...current.filter(book => book.id !== saved.id)].sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)));
      replace(fromBook(saved), false); setSuccess('Cartea a fost salvată și este vizibilă în pagina Cărți.');
    } catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); setProgress(null); }
  }
  async function refresh() {
    locked.current = true; setBusy(true); setError('');
    try { const data = await request('/api/books'); setBooks(data.books); setAvailable(true); replace(data.books[0] ? fromBook(data.books[0]) : null); }
    catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function remove() {
    if (!draft || draft.isNew || locked.current || !window.confirm(`Ștergi cartea „${draft.title}” din colecție?`)) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await request(`/api/books/${draft.id}`, { method: 'DELETE', body: JSON.stringify({ revision: draft.revision }) });
      const remaining = books.filter(book => book.id !== draft.id); setBooks(remaining); replace(remaining[0] ? fromBook(remaining[0]) : null); setSuccess('Cartea a fost ștearsă din colecție.');
    } catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="admin-page video-admin book-admin" lang="ro">
    <a className="skip-link" href="#main">Mergi la administrarea cărților</a>
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare administrare"><a className="nav-link" href="/admin">Poeme</a><a className="nav-link" href="/admin/video">Video</a><a className="nav-link" href="/admin/carti" aria-current="page">Cărți</a><a className="nav-link" href="/admin/comentarii">Comentarii</a><a className="nav-link" href="/carti">Vezi cărțile ↗</a><a className="nav-link" href="/admin/functionare">Funcționare</a><ThemeToggle /></nav></header>
    <main id="main" className="admin-main shell">
      <div className="admin-heading"><div><p className="eyebrow">Biblioteca ta</p><h1>Cărțile tale<span className="count">({books.length})</span></h1><p>Adaugă o carte sau alege una din colecție pentru a o modifica.</p></div><button className="primary-button" disabled={busy || !available} onClick={() => guard(() => replace(blank()))}>＋ Adaugă carte</button></div>
      {error && <div className="admin-error" role="alert"><p>{error}</p>{authRequired && <a href={signInHref} target="_blank" rel="noopener noreferrer">Autentifică-te într-o filă nouă, apoi reîncearcă</a>}</div>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <RecoveryTools kind="book" draft={recoveryDraft as EditorSnapshot | null} dirty={bookDirty} pendingFiles={pendingPdf || pendingCover} disabled={busy || !available} onRecover={snapshot => guard(() => {
        const current = books.find(book => book.id === snapshot.id);
        replace({ ...blank(), ...snapshot } as Draft);
        setBaseline(current ? fromBook(current) : null);
        setMissingFiles({ pdf: snapshot.pendingBookFile === true || (snapshot.pendingFiles === true && snapshot.pendingCover !== true), cover: snapshot.pendingCover === true });
      })} />
      <p className="field-help">Schițele și istoricul păstrează titlul, autorul, descrierea și referințele PDF/copertă. Corecturile textului paginilor se salvează separat în secțiunea de lectură accesibilă.</p>
      {(missingFiles.pdf || missingFiles.cover) && <div className="book-missing-files" role="status"><p>La salvarea schiței, {missingFiles.pdf && missingFiles.cover ? 'PDF-ul și coperta erau' : missingFiles.pdf ? 'PDF-ul era' : 'coperta era'} încă pe dispozitiv. Selectează din nou fișierele înainte de publicare.</p><button className="secondary-button" type="button" disabled={busy} onClick={() => { setMissingFiles({ pdf: false, cover: false }); }}>Păstrează referințele recuperate, fără fișierele neîncărcate</button></div>}
      <div className="admin-workspace">
        <aside className="poem-list" aria-label="Cărți salvate"><div className="poem-list-heading"><h2>Cărți</h2><button className="secondary-button" disabled={busy} onClick={() => guard(() => { void refresh(); })}>Reîncarcă</button></div><ul>{books.map(book => <li key={book.id}><button className={draft?.id === book.id ? 'selected' : undefined} aria-current={draft?.id === book.id ? 'true' : undefined} disabled={busy} onClick={() => guard(() => replace(fromBook(book)))}><span className="list-title">{book.title}</span><span className="list-author">{book.author || 'Carte'}</span></button></li>)}</ul>{!books.length && <p className="list-empty">{available ? 'Nu ai adăugat încă cărți.' : 'Lista nu este disponibilă.'}</p>}</aside>
        <section className="editor-panel" aria-label="Editor carte">{draft ? <form onSubmit={save}>
          <div className="editor-heading"><h2>{draft.isNew ? 'Carte nouă' : 'Editează cartea'}</h2><span className={dirty ? 'unsaved-label' : 'saved-label'}>{dirty ? 'Modificări nesalvate' : draft.isNew ? 'Necompletat' : 'Salvat'}</span></div>
          <fieldset className="editor-fields" disabled={busy}>
            <label>Copertă <span className="optional-label">(opțional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file || locked.current) return;
              if (!(IMAGE_TYPES as readonly string[]).includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) { setError('Alege o imagine JPEG, PNG sau WebP de maximum 5 MB.'); return; }
              setUploadedCoverId(null); setCover({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) }); setError(''); setSuccess('');
            }} /></label>
            {(cover || draft.image_id) && <><Image className="book-admin-cover" src={cover?.url || `/api/images/${draft.image_id}`} alt="Coperta cărții" width={240} height={320} unoptimized /><button type="button" className="secondary-button" onClick={() => { setCover(null); setDraft({ ...draft, image_id: null }); }}>Elimină coperta</button></>}

            <label>Titlu<input ref={title} required maxLength={180} value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); setSuccess(''); }} /></label>
            <label>Autor <span className="optional-label">(opțional)</span><input maxLength={120} value={draft.author} onChange={event => { setDraft({ ...draft, author: event.target.value }); setSuccess(''); }} /></label>
            <label>Descriere <span className="optional-label">(opțional)</span><textarea rows={5} maxLength={5000} value={draft.description} onChange={event => { setDraft({ ...draft, description: event.target.value }); setSuccess(''); }} /></label>
            <label>Fișier PDF<input ref={input} type="file" accept={BOOK_ACCEPT} onChange={event => choose(event.target.files?.[0])} aria-describedby="book-upload-help" /></label>
            <p id="book-upload-help" className="video-file-help">PDF fără parolă, maximum 100 MB și 2.000 de pagini. La salvare verificăm toate paginile; cartea se publică numai după finalizare. PDF-ul original rămâne disponibil doar în administrare.</p>
            {selected && <><p className="video-file-name">{selected.file.name} · {(selected.file.size / 1024 / 1024).toFixed(1)} MB</p><button type="button" className="secondary-button" onClick={() => { setSelected(null); setUploadedId(null); }}>Renunță la fișierul ales</button></>}
          </fieldset>
          {selected && <button type="button" className="secondary-button" disabled={busy || !!previewFileId} onClick={() => void preparePreview()}>Pregătește PDF privat pentru previzualizare</button>}
          {progress !== null && <div role="status"><p>{progress === 100 ? 'Fișierul este procesat…' : `Se încarcă: ${progress}%`}</p><progress value={progress} max={100} aria-label="Progresul încărcării" /><button type="button" className="secondary-button" onClick={() => upload.current?.abort()}>Anulează încărcarea</button></div>}
          {validation && <div role="status">
            <p>{validation.status === 'ready' ? `PDF verificat: ${validation.pages} pagini.` : validation.status === 'error' ? 'PDF-ul nu este pregătit pentru publicare.' : busy ? validation.pages ? `Se verifică paginile: ${validation.checkedPages} din ${validation.pages}. Versiunea nouă nu este încă publicată.` : 'Se pregătește verificarea PDF-ului. Versiunea nouă nu este încă publicată.' : 'Salvarea nu a fost finalizată. Reîncearcă pentru a verifica progresul PDF-ului.'}</p>
            {busy && validation.status === 'checking' && <><progress value={validation.pages ? validation.checkedPages : undefined} max={validation.pages || 1} aria-label="Progresul verificării PDF-ului" /><button type="button" className="secondary-button" onClick={() => validationRequest.current?.abort()}>Anulează salvarea</button></>}
          </div>}
          <div className="editor-actions"><button className="primary-button" type="submit" disabled={busy || !available}>{busy ? 'Se salvează…' : 'Salvează carte'}</button><button className="secondary-button" type="button" disabled={busy || !dirty} onClick={() => guard(() => replace(baseline))}>Renunță la modificări</button></div>
          {!draft.isNew && <div className="delete-area"><button type="button" className="delete-button" disabled={busy} onClick={() => { void remove(); }}>Șterge carte</button></div>}
        </form> : <div className="editor-empty"><span aria-hidden="true">▷</span><h2>Adaugă prima ta carte</h2><p>Alege un fișier de pe calculator și completează titlul.</p><button className="primary-button" disabled={busy || !available} onClick={() => replace(blank())}>Adaugă carte</button></div>}
        {draft && <ReaderPreview disabled={busy} note={<p>Descrierea și coperta sunt cele din editor. În modul Text apare și transcrierea curentă, încă nesalvată, pentru pagina editată. Cartea păstrează limba conținutului; RO/EN schimbă comenzile cititorului.</p>}>
          {language => <BookPresentation book={draft} language={language} coverSrc={cover?.url} fileId={previewFileId} preview previewText={previewText?.fileId === previewFileId ? previewText.data : undefined} />}
        </ReaderPreview>}
        {previewFileId && <BookTextEditor key={`${previewFileId}:${textEditorVersion}`} fileId={previewFileId} disabled={busy} onDirtyChange={setTextDirty} onPreviewChange={setPreviewText} />}
        </section>
      </div>
    </main><footer className="admin-footer shell"><span>Poetio · Administrare cărți</span><a href="/carti">Vezi pagina Cărți ↗</a></footer>
  </div>;
}
