'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation with the existing administration. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_BOOK_BYTES, BOOK_ACCEPT, bookFileType, type Book } from '@/lib/book-types';
import ThemeToggle from '../../theme-toggle';
import BookReader from './book-preview';
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
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(initialError ? 'Cărțile nu pot fi încărcate momentan. Reîncarcă lista.' : '');
  const [success, setSuccess] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const upload = useRef<XMLHttpRequest | null>(null);
  const uploadedId = useRef<string | null>(null);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || selected !== null || cover !== null;
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  useEffect(() => () => upload.current?.abort(), []);
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.url); }, [cover]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  function report(error: unknown) { setError(error instanceof Error ? error.message : 'Operația nu a reușit. Reîncearcă.'); setAuthRequired(error instanceof RequestError && error.status === 401); }
  function replace(value: Draft | null) {
    setDraft(value); setBaseline(value); setSelected(null); setCover(null); uploadedId.current = null;
    setError(''); setSuccess(''); setAuthRequired(false); setProgress(null);
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
    setError(''); setSuccess('');
    if (!bookFileType(file)) { setError('Alege un fișier PDF.'); return; }
    if (!file.size || file.size > MAX_BOOK_BYTES) { setError('Alege un fișier PDF de maximum 100 MB, care nu este gol.'); return; }
    setSelected({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) });
    uploadedId.current = null;
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
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || locked.current) return;
    if (!selected && !draft.file_id) { setError('Alege un fișier PDF.'); return; }
    locked.current = true; setBusy(true); setError(''); setSuccess(''); setAuthRequired(false);
    try {
      let fileId = draft.file_id;
      if (selected) {
        if (uploadedId.current !== selected.id) { setProgress(0); uploadedId.current = await uploadFile(selected); }
        fileId = uploadedId.current!;
      }
      let imageId = draft.image_id;
      if (cover) {
        const response = await fetch('/api/images', { method: 'POST', headers: { 'Content-Type': cover.file.type, 'X-Upload-Id': cover.id, 'X-File-Name': encodeURIComponent(cover.file.name) }, body: cover.file });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.image?.id) throw new RequestError(response.status, result?.error || 'Coperta nu a putut fi încărcată. Reîncearcă.');
        imageId = result.image.id;
      }
      setProgress(null);
      const data = await request(draft.isNew ? '/api/books' : `/api/books/${draft.id}`, { method: draft.isNew ? 'POST' : 'PUT', body: JSON.stringify({ ...draft, file_id: fileId, image_id: imageId }) });
      const saved = data.book as Book;
      setBooks(current => [saved, ...current.filter(book => book.id !== saved.id)].sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)));
      replace(fromBook(saved)); setSuccess('Cartea a fost salvată și este vizibilă în pagina Cărți.');
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
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare administrare"><a className="nav-link" href="/admin">Poeme</a><a className="nav-link" href="/admin/video">Video</a><a className="nav-link" href="/admin/carti" aria-current="page">Cărți</a><a className="nav-link" href="/admin/comentarii">Comentarii</a><a className="nav-link" href="/carti">Vezi cărțile ↗</a><ThemeToggle /></nav></header>
    <main id="main" className="admin-main shell">
      <div className="admin-heading"><div><p className="eyebrow">Biblioteca ta</p><h1>Cărțile tale<span className="count">({books.length})</span></h1><p>Adaugă o carte sau alege una din colecție pentru a o modifica.</p></div><button className="primary-button" disabled={busy || !available} onClick={() => guard(() => replace(blank()))}>＋ Adaugă carte</button></div>
      {error && <div className="admin-error" role="alert"><p>{error}</p>{authRequired && <a href={signInHref} target="_blank" rel="noopener noreferrer">Autentifică-te într-o filă nouă, apoi reîncearcă</a>}</div>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <div className="admin-workspace">
        <aside className="poem-list" aria-label="Cărți salvate"><div className="poem-list-heading"><h2>Cărți</h2><button className="secondary-button" disabled={busy} onClick={() => guard(() => { void refresh(); })}>Reîncarcă</button></div><ul>{books.map(book => <li key={book.id}><button className={draft?.id === book.id ? 'selected' : undefined} aria-current={draft?.id === book.id ? 'true' : undefined} disabled={busy} onClick={() => guard(() => replace(fromBook(book)))}><span className="list-title">{book.title}</span><span className="list-author">{book.author || 'Carte'}</span></button></li>)}</ul>{!books.length && <p className="list-empty">{available ? 'Nu ai adăugat încă cărți.' : 'Lista nu este disponibilă.'}</p>}</aside>
        <section className="editor-panel" aria-label="Editor carte">{draft ? <form onSubmit={save}>
          <div className="editor-heading"><h2>{draft.isNew ? 'Carte nouă' : 'Editează cartea'}</h2><span className={dirty ? 'unsaved-label' : 'saved-label'}>{dirty ? 'Modificări nesalvate' : draft.isNew ? 'Necompletat' : 'Salvat'}</span></div>
          <fieldset className="editor-fields" disabled={busy}>
            <label>Copertă <span className="optional-label">(opțional)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file || locked.current) return;
              if (!(IMAGE_TYPES as readonly string[]).includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) { setError('Alege o imagine JPEG, PNG sau WebP de maximum 5 MB.'); return; }
              setCover({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) }); setError(''); setSuccess('');
            }} /></label>
            {(cover || draft.image_id) && <><Image className="book-admin-cover" src={cover?.url || `/api/images/${draft.image_id}`} alt="Coperta cărții" width={240} height={320} unoptimized /><button type="button" className="secondary-button" onClick={() => { setCover(null); setDraft({ ...draft, image_id: null }); }}>Elimină coperta</button></>}

            <label>Titlu<input ref={title} required maxLength={180} value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); setSuccess(''); }} /></label>
            <label>Autor <span className="optional-label">(opțional)</span><input maxLength={120} value={draft.author} onChange={event => { setDraft({ ...draft, author: event.target.value }); setSuccess(''); }} /></label>
            <label>Descriere <span className="optional-label">(opțional)</span><textarea rows={5} maxLength={5000} value={draft.description} onChange={event => { setDraft({ ...draft, description: event.target.value }); setSuccess(''); }} /></label>
            <label>Fișier PDF<input ref={input} type="file" accept={BOOK_ACCEPT} onChange={event => choose(event.target.files?.[0])} aria-describedby="book-upload-help" /></label>
            <p id="book-upload-help" className="video-file-help">PDF, maximum 100 MB. Fișierul ales se încarcă la salvare. Cititorii vor vedea paginile cărții în cititorul online. PDF-ul original rămâne disponibil doar în administrare.</p>
            {selected && <><p className="video-file-name">{selected.file.name} · {(selected.file.size / 1024 / 1024).toFixed(1)} MB</p><button type="button" className="secondary-button" onClick={() => { setSelected(null); uploadedId.current = null; }}>Renunță la fișierul ales</button></>}
          </fieldset>
          {(selected || draft.file_id) && <BookReader key={selected?.url || draft.file_id} src={selected?.url || `/api/book-files/${draft.file_id}`} title={draft.title || 'Previzualizare carte'} />}
          {progress !== null && <div role="status"><p>{progress === 100 ? 'Fișierul este procesat…' : `Se încarcă: ${progress}%`}</p><progress value={progress} max={100} aria-label="Progresul încărcării" /><button type="button" className="secondary-button" onClick={() => upload.current?.abort()}>Anulează încărcarea</button></div>}
          <div className="editor-actions"><button className="primary-button" type="submit" disabled={busy || !available}>{busy ? 'Se salvează…' : 'Salvează carte'}</button><button className="secondary-button" type="button" disabled={busy || !dirty} onClick={() => guard(() => replace(baseline))}>Renunță la modificări</button></div>
          {!draft.isNew && <div className="delete-area"><button type="button" className="delete-button" disabled={busy} onClick={() => { void remove(); }}>Șterge carte</button></div>}
        </form> : <div className="editor-empty"><span aria-hidden="true">▷</span><h2>Adaugă prima ta carte</h2><p>Alege un fișier de pe calculator și completează titlul.</p><button className="primary-button" disabled={busy || !available} onClick={() => replace(blank())}>Adaugă carte</button></div>}</section>
      </div>
    </main><footer className="admin-footer shell"><span>Poetio · Administrare cărți</span><a href="/carti">Vezi pagina Cărți ↗</a></footer>
  </div>;
}
