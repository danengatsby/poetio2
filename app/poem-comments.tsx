'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import { commentCountLabel, COMMENT_NAME_LIMIT, COMMENT_BODY_LIMIT, type ReaderComment } from '@/lib/poem-comments';
import './poem-comments.css';

const copy = {
  ro: { title: 'Comentarii', intro: 'Ce ți-a transmis acest poem? Lasă câteva gânduri.', name: 'Numele tău', body: 'Comentariul tău', note: 'Numele și comentariul vor fi publice după aprobarea administratorului. Te rugăm să păstrezi un ton respectuos.', send: 'Trimite comentariul', sending: 'Se trimite…', loading: 'Se încarcă comentariile…', empty: 'Fii primul care lasă un comentariu.', more: 'Mai multe comentarii', retry: 'Reîncearcă', loadError: 'Comentariile nu pot fi încărcate momentan.', sendError: 'Comentariul nu a putut fi publicat. Textul tău a fost păstrat; încearcă din nou.', slow: 'Ai trimis prea multe comentarii. Așteaptă un minut și încearcă din nou.', success: 'Comentariul a fost primit și va apărea după aprobarea administratorului.' },
  'en-US': { title: 'Comments', intro: 'What did this poem bring to mind? Share a few thoughts.', name: 'Your name', body: 'Your comment', note: 'Your name and comment will be public after administrator approval. Please keep the conversation respectful.', send: 'Submit comment', sending: 'Submitting…', loading: 'Loading comments…', empty: 'Be the first to leave a comment.', more: 'More comments', retry: 'Try again', loadError: 'Comments could not be loaded right now.', sendError: 'Your comment could not be posted. Your text has been kept; please try again.', slow: 'You have posted too many comments. Wait a minute and try again.', success: 'Your comment has been received and will appear after administrator approval.' },
};

export default function PoemComments({ poemId, language, onCountChange }: { poemId: string; language: PoemLanguage; onCountChange?: (poemId: string, total: number) => void }) {
  const updateCount = useCallback((total: number) => onCountChange?.(poemId, total), [poemId, onCountChange]);
  return <ReaderComments key={poemId} endpoint={`/api/poems/${poemId}/comments`} language={language} onCountChange={updateCount} />;
}

export function ReaderComments({ endpoint, language, intro, onCountChange }: { endpoint: string; language: PoemLanguage; intro?: string; onCountChange?: (total: number) => void }) {
  const labels = copy[language];
  const id = useId();
  const [total, setTotal] = useState<number | null>(null);
  const [comments, setComments] = useState<ReaderComment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<'sendError' | 'slow' | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const attempt = useRef<{ id: string; name: string; content: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?offset=${offset}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Comments unavailable');
        const data = await response.json() as { comments: ReaderComment[]; hasMore: boolean; total?: number };
        if (controller.signal.aborted) return;
        setComments(previous => offset === 0 ? data.comments : [...previous, ...data.comments.filter(comment => !previous.some(item => item.id === comment.id))]);
        if (typeof data.total === 'number') { setTotal(data.total); onCountChange?.(data.total); }
        setHasMore(data.hasMore);
        setLoading(false);
      })
      .catch(() => { if (!controller.signal.aborted) { setLoadFailed(true); setLoading(false); } });
    return () => controller.abort();
  }, [endpoint, offset, reload, onCountChange]);

  function load(nextOffset: number) {
    setLoading(true); setLoadFailed(false); setOffset(nextOffset); setReload(value => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !name.trim() || !content.trim()) return;
    pending.current = true;
    setSending(true); setSendError(null); setSaved(false);
    try {
      // Reuse the request ID after a lost response to avoid posting twice.
      if (!attempt.current || attempt.current.name !== name.trim() || attempt.current.content !== content.trim()) attempt.current = { id: crypto.randomUUID(), name: name.trim(), content: content.trim() };
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.current) });
      if (!response.ok) { setSendError(response.status === 429 ? 'slow' : 'sendError'); return; }
      const data = await response.json() as { received?: boolean };
      if (!data.received) throw new Error('Receipt unavailable');
      setContent(''); setSaved(true); attempt.current = null;
      load(0);
    } catch { setSendError('sendError'); }
    finally { pending.current = false; setSending(false); }
  }

  return <section className="poem-comments" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{total === null ? labels.title : commentCountLabel(total, language)}</h2>
    <p className="comments-intro">{intro ?? labels.intro}</p>
    <form onSubmit={submit} className="comment-form" aria-describedby={`${id}-note`}>
      <label htmlFor={`${id}-name`}>{labels.name}</label>
      <input id={`${id}-name`} name="name" autoComplete="name" required maxLength={COMMENT_NAME_LIMIT} value={name} disabled={sending} onChange={event => { setName(event.target.value); setSaved(false); }} />
      <label htmlFor={`${id}-content`}>{labels.body}</label>
      <textarea id={`${id}-content`} name="comment" rows={4} required maxLength={COMMENT_BODY_LIMIT} value={content} disabled={sending} onChange={event => { setContent(event.target.value); setSaved(false); }} aria-describedby={`${id}-length`} />
      <span id={`${id}-length`} className="comment-length">{content.length} / {COMMENT_BODY_LIMIT}</span>
      <p id={`${id}-note`} className="comment-note">{labels.note}</p>
      <button type="submit" className="primary-button" disabled={sending || !name.trim() || !content.trim()}>{sending ? labels.sending : labels.send}</button>
      {sendError && <p role="alert" className="comment-error">{labels[sendError]}</p>}
      <p role="status" className="comment-status">{saved ? labels.success : ''}</p>
    </form>
    {comments.length > 0 && <ol className="comment-list">{comments.map(comment => <li key={comment.id}>
      <div className="comment-meta"><strong dir="auto">{comment.name}</strong><time dateTime={new Date(comment.created_at).toISOString()}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(comment.created_at)}</time></div>
      <p dir="auto">{comment.content}</p>
    </li>)}</ol>}
    {loading && <p role="status" className="comment-note">{labels.loading}</p>}
    {loadFailed && <div role="alert"><p>{labels.loadError}</p><button className="secondary-button" onClick={() => load(offset)}>{labels.retry}</button></div>}
    {!loading && !loadFailed && !comments.length && <p className="comment-note">{labels.empty}</p>}
    {hasMore && !loadFailed && <button className="secondary-button" disabled={loading} onClick={() => load(offset + 20)}>{labels.more}</button>}
  </section>;
}
