'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Reflect browser drafts after hydration and persistence. */
import { useEffect, useRef, useState } from 'react';
import { localTextDrafts, textDraftPrefix, textSnapshot, type BookTextSnapshot, type LocalTextDraft } from '@/lib/book-text-recovery';
import type { RecoveryEntry } from '@/lib/editorial';
import '../recovery.css';

export default function BookTextRecovery({ fileId, page, snapshot, dirty, disabled, onRecover }: {
  fileId: string; page: number; snapshot: BookTextSnapshot | null; dirty: boolean; disabled: boolean; onRecover: (value: BookTextSnapshot) => void;
}) {
  const [local, setLocal] = useState<LocalTextDraft[]>([]), [localStatus, setLocalStatus] = useState('');
  const [source, setSource] = useState<'drafts' | 'history'>('drafts'), [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<RecoveryEntry[]>([]), [hasMore, setHasMore] = useState(false);
  const [preview, setPreview] = useState<BookTextSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const localKey = useRef<string | null>(null), pending = useRef(false), attempt = useRef<{ id: string; body: string } | null>(null);
  const abort = useRef<AbortController | null>(null), mounted = useRef(true);
  const endpoint = `/api/admin/book-text/${fileId}/${page}/recovery`, locked = disabled || busy;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => {
    const refresh = () => { try { setLocal(localTextDrafts(localStorage, fileId)); } catch { setLocalStatus('Browserul nu permite schițe locale. Salvează schița privat pe server.'); } };
    refresh();
    const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(textDraftPrefix(fileId))) refresh(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [fileId]);
  useEffect(() => {
    if (!snapshot) return;
    try {
      if (dirty) {
        localKey.current ??= textDraftPrefix(fileId) + page + ':' + crypto.randomUUID();
        localStorage.setItem(localKey.current, JSON.stringify({ version: 1, snapshot, savedAt: Date.now() }));
        setLocalStatus('Corectura este salvată automat în acest browser.');
      } else if (localKey.current) { localStorage.removeItem(localKey.current); localKey.current = null; setLocalStatus('Corectura salvată se găsește în istoric.'); }
      setLocal(localTextDrafts(localStorage, fileId));
    } catch { setLocalStatus('Corectura nu poate fi memorată în browser. Salvează schița privat pe server înainte de a pleca.'); }
  }, [snapshot, dirty, fileId, page]);
  async function request(query = '', options: RequestInit = {}) {
    const controller = new AbortController(); abort.current = controller;
    const response = await fetch(endpoint + query, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Recuperarea nu este disponibilă momentan.');
    return value;
  }
  async function task(action: () => Promise<void>) {
    if (pending.current || disabled) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Recuperarea nu este disponibilă.'); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  async function list(nextSource = source, nextOffset = offset) {
    const value = await request(`?source=${nextSource}&offset=${nextOffset}`);
    if (!mounted.current) return;
    setSource(nextSource); setOffset(nextOffset); setEntries(value.entries); setHasMore(value.hasMore); setPreview(null);
  }
  async function save() {
    if (!snapshot) return;
    const body = JSON.stringify(snapshot);
    if (attempt.current?.body !== body) attempt.current = { body, id: crypto.randomUUID() };
    await request('', { method: 'POST', body: JSON.stringify({ id: attempt.current.id, snapshot }) });
    if (!mounted.current) return;
    setNotice('Schița transcrierii este salvată privat pe server. Nu este publicată.');
    await list('drafts', 0);
  }
  return <section className="recovery-tools" aria-label="Recuperarea transcrierii">
    <h3>Schițe și istoric pentru transcrieri</h3>
    <p>Corecturile sunt legate de PDF și pagină. Recuperarea cere o nouă verificare înainte de publicare.</p>
    <button type="button" className="secondary-button" disabled={locked || !snapshot} onClick={() => void task(save)}>Salvează schița transcrierii pe server</button>
    {localStatus && <p role="status">{localStatus}</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <details><summary onClick={() => { if (!locked) void task(() => list(source, 0)); }}>Recuperează transcrieri</summary>
      <h4>Schițe locale pentru acest PDF</h4>
      {local.length ? <ul>{local.map(item => <li key={item.key}><span>Pagina {item.snapshot.page} · {new Date(item.savedAt).toLocaleString('ro')}</span><button type="button" className="text-button" disabled={locked} onClick={() => setPreview(item.snapshot)}>Compară schița locală</button><button type="button" className="delete-button" disabled={locked} onClick={() => { if (window.confirm('Ștergi această schiță locală?')) try { localStorage.removeItem(item.key); if (localKey.current === item.key) localKey.current = null; setLocal(localTextDrafts(localStorage, fileId)); setPreview(null); setLocalStatus('Schița locală a fost ștearsă. Textul din editor rămâne disponibil.'); } catch { setError('Schița nu poate fi ștearsă.'); } }}>Șterge</button></li>)}</ul> : <p>Nu există schițe locale pentru acest PDF.</p>}
      <h4>Pagina {page}: versiuni pe server</h4>
      <div className="recovery-tabs"><button type="button" className="secondary-button" disabled={locked} aria-pressed={source === 'drafts'} onClick={() => void task(() => list('drafts', 0))}>Schițe private</button><button type="button" className="secondary-button" disabled={locked} aria-pressed={source === 'history'} onClick={() => void task(() => list('history', 0))}>Istoricul transcrierii</button><button type="button" className="text-button" disabled={locked} onClick={() => void task(() => list())}>Actualizează lista</button></div>
      <p>Istoricul păstrează versiunile existente la activare și salvările ulterioare. Versiunile anterioare activării nu pot fi reconstruite.</p>
      {entries.length ? <ul>{entries.map(item => <li key={item.id}><span>{item.revision ? `v${item.revision} · ` : ''}{item.event === 'deleted' ? 'Șters · ' : ''}{new Date(item.created_at ?? item.recorded_at ?? 0).toLocaleString('ro')}</span><button type="button" className="text-button" disabled={locked} onClick={() => void task(async () => { const result = await request(`?source=${source}&id=${item.id}`); const value = textSnapshot(result.snapshot); if (!value || value.fileId !== fileId || value.page !== page) throw new Error('Versiunea nu corespunde paginii.'); if (mounted.current) setPreview(value); })}>Compară versiunea</button>{source === 'drafts' && <button type="button" className="delete-button" disabled={locked} onClick={() => { if (window.confirm('Ștergi definitiv această schiță privată?')) void task(async () => { await request(`?id=${item.id}`, { method: 'DELETE' }); await list(source, entries.length === 1 && offset > 0 ? offset - 20 : offset); }); }}>Șterge</button>}</li>)}</ul> : <p>Nu există înregistrări în această listă.</p>}
      {(offset > 0 || hasMore) && <div className="recovery-tabs"><button type="button" disabled={locked || offset === 0} onClick={() => void task(() => list(source, offset - 20))}>Anterioarele</button><span>Pagina {offset / 20 + 1}</span><button type="button" disabled={locked || !hasMore} onClick={() => void task(() => list(source, offset + 20))}>Următoarele</button></div>}
      {preview && <article className="recovery-preview"><h4>Versiunea aleasă — pagina {preview.page}, limba {preview.language}</h4><pre>{preview.text || '(Text gol)'}</pre><h4>Textul din editor — pagina {page}</h4><pre>{snapshot?.text || '(Text gol)'}</pre><button type="button" className="primary-button" disabled={locked} onClick={() => onRecover(preview)}>Încarcă transcrierea în editor, fără publicare</button></article>}
    </details>
  </section>;
}
