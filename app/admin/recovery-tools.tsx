'use client';
/* eslint-disable react-hooks/set-state-in-effect -- Synchronize the recovery list with browser-only storage after hydration and persistence. */
import { useEffect, useRef, useState } from 'react';
import { localDraftPrefix, type ContentKind, type EditorSnapshot, type LocalDraft, type RecoveryEntry } from '@/lib/editorial';
import './recovery.css';

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Recuperarea nu este disponibilă. Reîncarcă lista.');
  return data;
}
function readLocal(kind: ContentKind): LocalDraft[] {
  const entries: LocalDraft[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(localDraftPrefix(kind))) continue;
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); if (value?.kind === kind && typeof value.snapshot?.id === 'string' && typeof value.snapshot?.title === 'string' && Number.isSafeInteger(value.snapshot?.revision)) entries.push({ ...value, key }); } catch { /* A corrupt entry does not hide other drafts. */ }
  }
  return entries.sort((a,b) => b.savedAt - a.savedAt);
}
export default function RecoveryTools({ kind, draft, dirty, pendingFiles, disabled, onRecover }: {
  kind: ContentKind; draft: EditorSnapshot | null; dirty: boolean; pendingFiles: boolean; disabled: boolean; onRecover: (snapshot: EditorSnapshot) => void;
}) {
  const [local, setLocal] = useState<LocalDraft[]>([]), [localStatus, setLocalStatus] = useState('');
  const [source, setSource] = useState<'drafts' | 'history'>('drafts'), [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<RecoveryEntry[]>([]), [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<{ snapshot: EditorSnapshot; source: string; id: string } | null>(null);
  const localKeys = useRef(new Map<string,string>());
  const inFlight = useRef(false);
  const saveAttempt = useRef<{id:string;body:string}|null>(null);
  const locked = disabled || busy;
  useEffect(() => {
    try { setLocal(readLocal(kind)); } catch { setLocalStatus('Browserul nu permite salvarea automată. Folosește „Salvează schița pe server”.'); }
  }, [kind]);
  useEffect(() => {
    if (!draft) return;
    try {
      let key = localKeys.current.get(draft.id);
      if (!dirty) { if (key) { localStorage.removeItem(key); localKeys.current.delete(draft.id); setLocal(readLocal(kind)); } return; }
      if (!key) { key = localDraftPrefix(kind) + crypto.randomUUID(); localKeys.current.set(draft.id,key); }
      localStorage.setItem(key, JSON.stringify({ kind, snapshot: draft, pendingFiles, savedAt: Date.now() }));
      setLocalStatus('Schița este salvată automat în acest browser.');
      setLocal(readLocal(kind));
    } catch { setLocalStatus('Schița nu poate fi memorată în browser. Salveaz-o pe server înainte de a închide pagina.'); }
  }, [draft, dirty, kind, pendingFiles]);
  async function load(nextSource = source, nextOffset = offset) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setPreview(null);
    try { const data = await request(`/api/admin/recovery/${kind}/${nextSource}?offset=${nextOffset}`); setEntries(data.entries); setHasMore(data.hasMore); setSource(nextSource); setOffset(nextOffset); }
    catch(error){setError((error as Error).message);}
    finally{setBusy(false);inFlight.current=false;}
  }
  async function save() {
    if (!draft || inFlight.current) return;
    inFlight.current = true;setBusy(true);setError('');setNotice('');
    const body = JSON.stringify({ ...draft, pendingFiles });
    if (!saveAttempt.current || saveAttempt.current.body !== body) saveAttempt.current = { id: crypto.randomUUID(), body };
    let saved = false;
    try { await request(`/api/admin/recovery/${kind}/drafts`, { method:'POST', body:JSON.stringify({id:saveAttempt.current.id,snapshot:JSON.parse(body)}) }); saved = true; setNotice('Schița a fost salvată privat pe server. Nu este publicată.'); }
    catch(error){setError((error as Error).message);}
    finally{setBusy(false);inFlight.current=false;}
    if (saved) await load('drafts',0);
  }
  async function inspect(id: string | number) {
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    try { const data = await request(`/api/admin/recovery/${kind}/${source}/${id}`);setPreview({snapshot:data.snapshot,source,id:String(id)}); }
    catch(error){setError((error as Error).message);}
    finally{setBusy(false);inFlight.current=false;}
  }
  async function restore() {
    if(!preview||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    try {
      let snapshot = preview.snapshot;
      if(preview.source === 'local') {
        const plural=kind==='poem'?'poems':'videos';const data=await request('/api/'+plural);const current=data[plural].find((item:EditorSnapshot)=>item.id===snapshot.id);
        snapshot={...snapshot,id:!current&&snapshot.id.startsWith('original-')?crypto.randomUUID():snapshot.id,revision:current?.revision??1,isNew:!current};
      } else snapshot=(await request(`/api/admin/recovery/${kind}/${preview.source}/${preview.id}`)).snapshot;
      onRecover(snapshot);setNotice('Versiunea este pregătită pentru editor. Verifică datele și salvează pentru a publica.' + (snapshot.pendingFiles ? ' Selectează din nou fișierele care nu fuseseră încărcate.' : ''));
    } catch(error){setError((error as Error).message);}
    finally{setBusy(false);inFlight.current=false;}
  }
  async function remove(id: string | number) {
    if(locked||!window.confirm('Ștergi definitiv această schiță salvată?'))return;
    setBusy(true);inFlight.current=true;setError('');
    let removed=false;
    try{await request(`/api/admin/recovery/${kind}/drafts/${id}`,{method:'DELETE'});removed=true;setPreview(null);}
    catch(error){setError((error as Error).message);}
    finally{setBusy(false);inFlight.current=false;}
    if(removed) await load('drafts',entries.length===1&&offset>0?offset-20:offset);
  }
  return <section className="recovery-tools" aria-label="Schițe și istoric">
    <div className="recovery-save"><button type="button" className="secondary-button" disabled={locked||!draft} onClick={()=>void save()}>Salvează schița pe server</button><p role="status">{dirty ? localStatus : 'Versiunile publicate sunt păstrate automat în istoric.'}</p></div>
    <p className="field-help">Salvarea unei schițe nu publică. Fișierele încă neîncărcate trebuie selectate din nou după recuperare.</p>
    {pendingFiles&&<p className="field-help">Ai fișiere selectate doar pe acest dispozitiv; schița păstrează textul și referințele deja salvate.</p>}
    {error&&<p role="alert" className="admin-error">{error}</p>}{notice&&<p role="status" className="admin-success">{notice}</p>}
    <details><summary onClick={()=>{if(!busy)void load(source,0);}}>Recuperează schițe și versiuni</summary>
      <h3>Schițe din acest browser</h3>
      {local.length?<ul>{local.map(item=><li key={item.key}><span>{item.snapshot.title||'Fără titlu'} · {new Date(item.savedAt).toLocaleString('ro')}</span><button type="button" className="text-button" disabled={locked} onClick={()=>setPreview({snapshot:{...item.snapshot,pendingFiles:item.pendingFiles},source:'local',id:item.key})}>Previzualizează</button><button type="button" className="delete-button" disabled={locked} onClick={()=>{if(window.confirm('Ștergi această schiță locală?'))try{localStorage.removeItem(item.key);setLocal(readLocal(kind));setPreview(null);}catch{setError('Schița nu poate fi ștearsă.');}}}>Șterge</button></li>)}</ul>:<p>Nu există schițe locale de recuperat.</p>}
      <div className="recovery-tabs"><button type="button" className="secondary-button" disabled={locked} aria-pressed={source==='drafts'} onClick={()=>void load('drafts',0)}>Schițe pe server</button><button type="button" className="secondary-button" disabled={locked} aria-pressed={source==='history'} onClick={()=>void load('history',0)}>Istoric de versiuni</button><button type="button" className="text-button" disabled={locked} onClick={()=>void load()}>Reîncarcă</button></div>
      <p className="field-help">Istoricul începe de la activarea funcției și include conținutul șters. Recuperarea conținutului șters nu readuce comentariile eliminate.</p>
      {entries.length?<ul>{entries.map(item=><li key={item.id}><span><strong>{item.title||'Fără titlu'}</strong> · {item.revision?`v${item.revision} · `:''}{item.event==='deleted'?'Șters · ':item.event==='initial'?'Versiune inițială · ':''}{new Date(item.created_at??item.recorded_at??0).toLocaleString('ro')}</span><button type="button" className="text-button" disabled={locked} onClick={()=>void inspect(item.id)}>Previzualizează</button>{source==='drafts'&&<button type="button" className="delete-button" disabled={locked} onClick={()=>void remove(item.id)}>Șterge</button>}</li>)}</ul>:<p>Nu există înregistrări în această listă.</p>}
      {(offset>0||hasMore)&&<div className="recovery-tabs"><button type="button" className="secondary-button" disabled={locked||offset===0} onClick={()=>void load(source,offset-20)}>Anterioarele</button><span>Pagina {offset/20+1}</span><button type="button" className="secondary-button" disabled={locked||!hasMore} onClick={()=>void load(source,offset+20)}>Următoarele</button></div>}
      {preview&&<article className="recovery-preview"><h3>{preview.snapshot.title||'Schiță fără titlu'}</h3><p>{String(preview.snapshot.author||'')}</p><pre>{String(preview.snapshot.content??preview.snapshot.description??'')}</pre>{preview.snapshot.translated_content?<><h4>{String(preview.snapshot.translated_title||'Traducere')}</h4><pre>{String(preview.snapshot.translated_content)}</pre></>:null}{preview.snapshot.pendingFiles?<p>Realege fișierele care nu fuseseră încărcate.</p>:null}<button type="button" className="primary-button" disabled={locked} onClick={()=>void restore()}>Încarcă în editor, fără publicare</button></article>}
    </details>
  </section>;
}
