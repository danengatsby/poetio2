'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Keep the existing full-document administration navigation. */
import { useEffect, useRef, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { COMMENT_KINDS, COMMENT_STATUSES, kindLabels, statusLabels, type CommentKind, type CommentStatus, type ModeratedComment, type ModerationPage } from '@/lib/comment-moderation';
import ThemeToggle from '../../theme-toggle';
import './comments-admin.css';

const emptyMessages = { pending: 'Nu sunt comentarii în așteptare.', approved: 'Nu sunt comentarii publicate.', hidden: 'Nu sunt comentarii ascunse.', all: 'Nu sunt comentarii în această categorie.' };
const singularStatus = { pending: 'În așteptare', approved: 'Publicat', hidden: 'Ascuns' };

export default function CommentAdmin({ signInHref }: { signInHref: string }) {
  const [kind, setKind] = useState<CommentKind | 'all'>('all');
  const [status, setStatus] = useState<CommentStatus | 'all'>('pending');
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ModerationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<ModeratedComment | null>(null);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const locked = loading || busy;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/comments?kind=${kind}&status=${status}&offset=${offset}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setAuthRequired(response.status === 401 || response.status === 403);
          throw new Error(result?.error || 'Comentariile nu pot fi încărcate. Încearcă din nou.');
        }
        if (!result || !Array.isArray(result.comments)) throw new Error('Lista nu poate fi citită. Reîncearcă.');
        setData(result);
        setAuthRequired(false);
      })
      .catch(error => { if (!controller.signal.aborted) { setData(null); setError(error.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, status, offset, reload]);

  function refresh(nextOffset = offset) {
    setLoading(true); setError(''); setOffset(nextOffset); setReload(value => value + 1);
  }
  function filterStatus(value: CommentStatus | 'all') {
    if (locked) return;
    setStatus(value); setNotice(''); refresh(0);
  }
  async function act(comment: ModeratedComment, next: CommentStatus | 'delete') {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/comments/${comment.kind}/${comment.id}`, {
        method: next === 'delete' ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: comment.revision, ...(next !== 'delete' ? { status: next } : {}) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setAuthRequired(response.status === 401 || response.status === 403);
        throw new Error(result?.error || 'Acțiunea nu a fost confirmată. Reîncarcă lista înainte de a încerca din nou.');
      }
      if (!result) throw new Error('Răspunsul nu poate fi citit. Reîncarcă lista pentru a verifica starea comentariului.');
      setNotice(next === 'delete' ? 'Comentariul a fost șters.' : next === 'approved' ? 'Comentariul a fost aprobat și este vizibil public.' : 'Comentariul este ascuns și nu mai apare public.');
      setAuthRequired(false);
      const leavesPage = next === 'delete' || (status !== 'all' && status !== next);
      refresh(leavesPage && data?.comments.length === 1 && offset > 0 ? offset - 20 : offset);
    } catch (error) { setError(error instanceof Error ? error.message : 'Acțiunea nu a putut fi confirmată.'); }
    finally { setDeleting(null); setBusy(false); inFlight.current = false; }
  }

  const totalAll = data ? data.counts.pending + data.counts.approved + data.counts.hidden : null;
  return <div className="admin-page" lang="ro">
    <a className="skip-link" href="#moderation-main">Mergi la comentarii</a>
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare administrare"><a className="nav-link" href="/admin">Poeme</a><a className="nav-link" href="/admin/video">Video</a><a className="nav-link" href="/admin/carti">Cărți</a><a className="nav-link" href="/admin/comentarii" aria-current="page">Comentarii</a><a className="nav-link" href="/">Vezi colecția ↗</a><a className="nav-link" href="/admin/functionare">Funcționare</a><ThemeToggle /></nav></header>
    <main id="moderation-main" className="admin-main shell moderation-main">
      <div className="admin-heading"><div><p className="eyebrow">Conversațiile colecției</p><h1 ref={heading} tabIndex={-1}>Comentarii</h1><p>Comentariile noi așteaptă aprobarea ta. Poți ascunde oricând un comentariu publicat.</p></div><button className="secondary-button" disabled={locked} onClick={() => refresh()}>Reîncarcă lista</button></div>
      <div className="moderation-feedback">
        <p role="status" className={notice ? 'success-message' : undefined}>{notice}</p>
        {error && <div className="error-message" role="alert"><p>{error}</p><button className="text-button" disabled={locked} onClick={() => refresh()}>Reîncarcă lista</button>{authRequired && <a href={signInHref} target="_blank" rel="noopener noreferrer">Autentifică-te într-o filă nouă</a>}</div>}
      </div>
      <div className="moderation-filters">
        <label htmlFor="comment-kind">Comentarii pentru<select id="comment-kind" value={kind} disabled={locked} onChange={event => { setKind(event.target.value as CommentKind | 'all'); setNotice(''); refresh(0); }}><option value="all">Toate categoriile</option>{COMMENT_KINDS.map(value => <option key={value} value={value}>{kindLabels[value]}</option>)}</select></label>
        <div className="moderation-states" role="group" aria-label="Starea comentariilor">
          {([...COMMENT_STATUSES, 'all'] as const).map(value => <button key={value} className="secondary-button" disabled={locked} aria-pressed={status === value} onClick={() => filterStatus(value)}>{value === 'all' ? 'Toate' : statusLabels[value]}{data && <span> ({value === 'all' ? totalAll : data.counts[value]})</span>}</button>)}
        </div>
      </div>
      {loading && <p role="status">Se încarcă comentariile…</p>}
      <section aria-label="Lista comentariilor" aria-busy={loading}>
        {!loading && data && !data.comments.length && <p className="moderation-empty">{emptyMessages[status]}</p>}
        {data && data.comments.length > 0 && <ul className="moderation-list">{data.comments.map(comment => <li key={`${comment.kind}:${comment.id}`}>
          <article className="moderation-card" aria-label={`Comentariu de ${comment.name}`}>
            <div className="moderation-card-top"><p className="eyebrow">{kindLabels[comment.kind]}</p><span className={`moderation-badge moderation-${comment.status}`}>{singularStatus[comment.status]}</span></div>
            <h2>{comment.title}</h2>
            <div className="moderation-meta"><strong dir="auto">{comment.name}</strong><time dateTime={new Date(comment.created_at).toISOString()}>{new Intl.DateTimeFormat('ro', { dateStyle: 'medium', timeStyle: 'short' }).format(comment.created_at)}</time></div>
            <p className="moderation-body" dir="auto">{comment.content}</p>
            <div className="moderation-actions">
              {comment.status !== 'approved' && <button className="primary-button" disabled={locked} onClick={() => void act(comment, 'approved')}>Aprobă</button>}
              {comment.status !== 'hidden' && <button className="secondary-button" disabled={locked} onClick={() => void act(comment, 'hidden')}>Ascunde</button>}
              <button className="delete-button" disabled={locked} onClick={() => setDeleting(comment)}>Șterge</button>
            </div>
          </article>
        </li>)}</ul>}
      </section>
      {data && (offset > 0 || data.hasMore) && <nav className="moderation-pagination" aria-label="Pagini de comentarii"><button className="secondary-button" disabled={locked || offset === 0} onClick={() => refresh(Math.max(0, offset - 20))}>Anterioarele</button><span>Pagina {Math.floor(offset / 20) + 1} · {data.total} comentarii</span><button className="secondary-button" disabled={locked || !data.hasMore} onClick={() => refresh(offset + 20)}>Următoarele</button></nav>}
    </main>
    <footer className="admin-footer shell"><p>Poetio · Administrare privată</p><a href="/">Înapoi la colecție</a></footer>
    <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
      <AlertDialogContent lang="ro" onCloseAutoFocus={event => { event.preventDefault(); heading.current?.focus(); }}><AlertDialogHeader><AlertDialogTitle>Ștergi acest comentariu?</AlertDialogTitle><AlertDialogDescription>Comentariul scris de {deleting?.name} la „{deleting?.title}” va fi șters definitiv. Poemul, videoul sau cartea rămâne în colecție. Poți folosi „Ascunde” dacă vrei să păstrezi comentariul pentru mai târziu.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Păstrează comentariul</AlertDialogCancel><AlertDialogAction className="confirm-delete" disabled={busy} onClick={event => { event.preventDefault(); if (deleting) void act(deleting, 'delete'); }}>{busy ? 'Se șterge…' : 'Șterge definitiv'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
