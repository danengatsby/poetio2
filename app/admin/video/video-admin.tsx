'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation with the existing administration. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MAX_VIDEO_BYTES, VIDEO_ACCEPT, videoFileType, type Video } from '@/lib/video-types';
import RecoveryTools from '../recovery-tools';
import type { EditorSnapshot } from '@/lib/editorial';
import ThemeToggle from '../../theme-toggle';
import VideoReading from '../../video/video-reading';
import ReaderPreview from '../reader-preview';
import '../../video/video.css';

type Draft = Pick<Video, 'id' | 'title' | 'author' | 'description' | 'file_id' | 'revision'> & { isNew: boolean };
const fromVideo = (video: Video): Draft => ({ id: video.id, title: video.title, author: video.author, description: video.description, file_id: video.file_id, revision: video.revision, isNew: false });
const blank = (): Draft => ({ id: crypto.randomUUID(), title: '', author: '', description: '', file_id: '', revision: 1, isNew: true });
class RequestError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function request(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new RequestError(response.status, data?.error || (response.status === 401 ? 'Autentifică-te din nou. Datele introduse au fost păstrate.' : 'Cererea nu a reușit. Reîncearcă; datele introduse au fost păstrate.'));
  if (!data) throw new Error('Răspunsul nu poate fi citit. Reîncearcă salvarea.');
  return data;
}

type Selected = { file: File; id: string; url: string };
export default function VideoAdmin({ initialVideos, initialError, signInHref }: { initialVideos: Video[]; initialError: boolean; signInHref: string }) {
  const [videos, setVideos] = useState(initialVideos);
  const [draft, setDraft] = useState<Draft | null>(initialVideos[0] ? fromVideo(initialVideos[0]) : null);
  const [baseline, setBaseline] = useState(draft);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [available, setAvailable] = useState(!initialError);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState(initialError ? 'Videourile nu pot fi încărcate momentan. Reîncarcă lista.' : '');
  const [success, setSuccess] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const upload = useRef<XMLHttpRequest | null>(null);
  const uploadedId = useRef<string | null>(null);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || selected !== null;
  useEffect(() => () => { if (selected) URL.revokeObjectURL(selected.url); }, [selected]);
  useEffect(() => () => upload.current?.abort(), []);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  function report(error: unknown) { setError(error instanceof Error ? error.message : 'Operația nu a reușit. Reîncearcă.'); setAuthRequired(error instanceof RequestError && error.status === 401); }
  function replace(value: Draft | null) {
    setDraft(value); setBaseline(value); setSelected(null); uploadedId.current = null;
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
    if (!videoFileType(file)) { setError('Alege un fișier MP4 sau WebM.'); return; }
    if (!file.size || file.size > MAX_VIDEO_BYTES) { setError('Alege un fișier video de maximum 100 MB, care nu este gol.'); return; }
    setSelected({ file, id: crypto.randomUUID(), url: URL.createObjectURL(file) });
    uploadedId.current = null;
    if (input.current) input.current.value = '';
  }
  function uploadFile(file: Selected): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); upload.current = xhr;
      xhr.open('POST', '/api/video-files'); xhr.timeout = 10 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', videoFileType(file.file) || 'application/octet-stream');
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
    if (!selected && !draft.file_id) { setError('Alege un fișier video.'); return; }
    locked.current = true; setBusy(true); setError(''); setSuccess(''); setAuthRequired(false);
    try {
      let fileId = draft.file_id;
      if (selected) {
        if (uploadedId.current !== selected.id) { setProgress(0); uploadedId.current = await uploadFile(selected); }
        fileId = uploadedId.current!;
      }
      setProgress(null);
      const data = await request(draft.isNew ? '/api/videos' : `/api/videos/${draft.id}`, { method: draft.isNew ? 'POST' : 'PUT', body: JSON.stringify({ ...draft, file_id: fileId }) });
      const saved = data.video as Video;
      setVideos(current => [saved, ...current.filter(video => video.id !== saved.id)].sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)));
      replace(fromVideo(saved)); setSuccess('Videoul a fost salvat și este vizibil în pagina Video.');
    } catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); setProgress(null); }
  }
  async function refresh() {
    locked.current = true; setBusy(true); setError('');
    try { const data = await request('/api/videos'); setVideos(data.videos); setAvailable(true); replace(data.videos[0] ? fromVideo(data.videos[0]) : null); }
    catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  async function remove() {
    if (!draft || draft.isNew || locked.current || !window.confirm(`Ștergi videoul „${draft.title}” din colecție?`)) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await request(`/api/videos/${draft.id}`, { method: 'DELETE', body: JSON.stringify({ revision: draft.revision }) });
      const remaining = videos.filter(video => video.id !== draft.id); setVideos(remaining); replace(remaining[0] ? fromVideo(remaining[0]) : null); setSuccess('Videoul a fost șters din colecție.');
    } catch (error) { report(error); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="admin-page video-admin" lang="ro">
    <a className="skip-link" href="#main">Mergi la administrarea video</a>
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare administrare"><a className="nav-link" href="/admin">Poeme</a><a className="nav-link" href="/admin/video" aria-current="page">Video</a><a className="nav-link" href="/admin/carti">Cărți</a><a className="nav-link" href="/admin/comentarii">Comentarii</a><a className="nav-link" href="/video">Vezi videourile ↗</a><a className="nav-link" href="/admin/functionare">Funcționare</a><ThemeToggle /></nav></header>
    <main id="main" className="admin-main shell">
      <div className="admin-heading"><div><p className="eyebrow">Colecția ta în imagini</p><h1>Videourile tale<span className="count">({videos.length})</span></h1><p>Adaugă un video sau alege unul din colecție pentru a-l modifica.</p></div><button className="primary-button" disabled={busy || !available} onClick={() => guard(() => replace(blank()))}>＋ Adaugă video</button></div>
      {error && <div className="admin-error" role="alert"><p>{error}</p>{authRequired && <a href={signInHref} target="_blank" rel="noopener noreferrer">Autentifică-te într-o filă nouă, apoi reîncearcă</a>}</div>}
      {success && <p className="admin-success" role="status">{success}</p>}
      <RecoveryTools kind="video" draft={draft as EditorSnapshot | null} dirty={dirty} pendingFiles={selected !== null} disabled={busy} onRecover={snapshot => guard(() => { const current = videos.find(item => item.id === snapshot.id); replace({ ...blank(), ...snapshot } as Draft); setBaseline(current ? fromVideo(current) : null); })} />
      <div className="admin-workspace">
        <aside className="poem-list" aria-label="Videouri salvate"><div className="poem-list-heading"><h2>Videouri</h2><button className="secondary-button" disabled={busy} onClick={() => guard(() => { void refresh(); })}>Reîncarcă</button></div><ul>{videos.map(video => <li key={video.id}><button className={draft?.id === video.id ? 'selected' : undefined} aria-current={draft?.id === video.id ? 'true' : undefined} disabled={busy} onClick={() => guard(() => replace(fromVideo(video)))}><span className="list-title">{video.title}</span><span className="list-author">{video.author || 'Video'}</span></button></li>)}</ul>{!videos.length && <p className="list-empty">{available ? 'Nu ai adăugat încă videouri.' : 'Lista nu este disponibilă.'}</p>}</aside>
        <section className="editor-panel" aria-label="Editor video">{draft ? <form onSubmit={save}>
          <div className="editor-heading"><h2>{draft.isNew ? 'Video nou' : 'Editează videoul'}</h2><span className={dirty ? 'unsaved-label' : 'saved-label'}>{dirty ? 'Modificări nesalvate' : draft.isNew ? 'Necompletat' : 'Salvat'}</span></div>
          <fieldset className="editor-fields" disabled={busy}>
            <label>Titlu<input ref={title} required maxLength={180} value={draft.title} onChange={event => { setDraft({ ...draft, title: event.target.value }); setSuccess(''); }} /></label>
            <label>Autor <span className="optional-label">(opțional)</span><input maxLength={120} value={draft.author} onChange={event => { setDraft({ ...draft, author: event.target.value }); setSuccess(''); }} /></label>
            <label>Descriere <span className="optional-label">(opțional)</span><textarea rows={5} maxLength={5000} value={draft.description} onChange={event => { setDraft({ ...draft, description: event.target.value }); setSuccess(''); }} /></label>
            <label>Fișier video<input ref={input} type="file" accept={VIDEO_ACCEPT} onChange={event => choose(event.target.files?.[0])} aria-describedby="video-upload-help" /></label>
            <p id="video-upload-help" className="video-file-help">MP4 H.264/AAC sau WebM VP8/VP9 cu Opus/Vorbis, maximum 100 MB, 30 de minute și 4K la 60 fps. Fișierul se încarcă și este verificat integral la salvare.</p>
            {selected && <><p className="video-file-name">{selected.file.name} · {(selected.file.size / 1024 / 1024).toFixed(1)} MB</p><button type="button" className="secondary-button" onClick={() => { setSelected(null); uploadedId.current = null; }}>Renunță la fișierul ales</button></>}
          </fieldset>
          {progress !== null && <div role="status"><p>{progress === 100 ? 'Se verifică integral imaginea și sunetul…' : `Se încarcă: ${progress}%`}</p><progress value={progress} max={100} aria-label="Progresul încărcării" /><button type="button" className="secondary-button" onClick={() => upload.current?.abort()}>Anulează încărcarea</button></div>}
          <div className="editor-actions"><button className="primary-button" type="submit" disabled={busy || !available}>{busy ? 'Se salvează…' : 'Salvează video'}</button><button className="secondary-button" type="button" disabled={busy || !dirty} onClick={() => guard(() => replace(baseline))}>Renunță la modificări</button></div>
          {!draft.isNew && <div className="delete-area"><button type="button" className="delete-button" disabled={busy} onClick={() => { void remove(); }}>Șterge video</button></div>}
        </form> : <div className="editor-empty"><span aria-hidden="true">▷</span><h2>Adaugă primul tău video</h2><p>Alege un fișier de pe calculator și completează titlul.</p><button className="primary-button" disabled={busy || !available} onClick={() => replace(blank())}>Adaugă video</button></div>}
          {draft && <ReaderPreview disabled={busy} note={<p>Fișierul selectat se redă local și se încarcă pe server numai la salvare. Pornește redarea și verifică sunetul; RO/EN schimbă comenzile, nu traduce conținutul videoului.</p>}>
            {language => <VideoReading video={draft} src={selected?.url || (draft.file_id ? `/api/video-files/${draft.file_id}` : undefined)} language={language} mediaStatus />}
          </ReaderPreview>}
        </section>
      </div>
    </main><footer className="admin-footer shell"><span>Poetio · Administrare video</span><a href="/video">Vezi pagina Video ↗</a></footer>
  </div>;
}
