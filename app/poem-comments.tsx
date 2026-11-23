'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SiteLanguage } from '@/lib/poem-types';
import { commentCountLabel, COMMENT_NAME_LIMIT, COMMENT_BODY_LIMIT, type ReaderComment } from '@/lib/poem-comments';
import './poem-comments.css';
import useCommentDraft from './use-comment-draft';
import { pick } from '@/lib/site-language';

const copy = {
  ro: {
    title: 'Comentarii',
    intro: 'Ce ți-a transmis acest poem? Lasă câteva gânduri.',
    name: 'Numele tău',
    body: 'Comentariul tău',
    note: 'Numele și comentariul vor fi publice după aprobarea administratorului. Te rugăm să păstrezi un ton respectuos.',
    send: 'Trimite comentariul',
    sending: 'Se trimite…',
    loading: 'Se încarcă comentariile…',
    empty: 'Fii primul care lasă un comentariu.',
    more: 'Mai multe comentarii',
    retry: 'Reîncearcă',
    loadError: 'Comentariile nu pot fi încărcate momentan.',
    sendError: 'Comentariul nu a putut fi publicat. Textul tău a fost păstrat; încearcă din nou.',
    slow: 'Ai trimis prea multe comentarii. Așteaptă un minut și încearcă din nou.',
    success: 'Comentariul a fost primit și va apărea după aprobarea administratorului.',
  },
  'en-US': {
    title: 'Comments',
    intro: 'What did this poem bring to mind? Share a few thoughts.',
    name: 'Your name',
    body: 'Your comment',
    note: 'Your name and comment will be public after administrator approval. Please keep the conversation respectful.',
    send: 'Submit comment',
    sending: 'Submitting…',
    loading: 'Loading comments…',
    empty: 'Be the first to leave a comment.',
    more: 'More comments',
    retry: 'Try again',
    loadError: 'Comments could not be loaded right now.',
    sendError: 'Your comment could not be posted. Your text has been kept; please try again.',
    slow: 'You have posted too many comments. Wait a minute and try again.',
    success: 'Your comment has been received and will appear after administrator approval.',
  },
  fr: {
    title: 'Commentaires',
    intro: 'Qu’est-ce que ce poème vous a évoqué\u00a0? Partagez quelques pensées.',
    name: 'Votre nom',
    body: 'Votre commentaire',
    note: 'Votre nom et votre commentaire seront publics après validation par l’administrateur. Merci de rester respectueux.',
    send: 'Envoyer le commentaire',
    sending: 'Envoi…',
    loading: 'Chargement des commentaires…',
    empty: 'Soyez le premier à laisser un commentaire.',
    more: 'Plus de commentaires',
    retry: 'Réessayer',
    loadError: 'Les commentaires n’ont pas pu être chargés pour le moment.',
    sendError: 'Votre commentaire n’a pas pu être publié. Votre texte a été conservé\u00a0; réessayez.',
    slow: 'Vous avez envoyé trop de commentaires. Attendez une minute et réessayez.',
    success: 'Votre commentaire a bien été reçu et apparaîtra après validation par l’administrateur.',
  },
  de: {
    title: 'Kommentare',
    intro: 'Woran hat Sie dieses Gedicht erinnert? Teilen Sie ein paar Gedanken.',
    name: 'Ihr Name',
    body: 'Ihr Kommentar',
    note: 'Ihr Name und Ihr Kommentar werden nach Freigabe durch den Administrator öffentlich. Bitte bleiben Sie respektvoll.',
    send: 'Kommentar senden',
    sending: 'Wird gesendet…',
    loading: 'Kommentare werden geladen…',
    empty: 'Schreiben Sie den ersten Kommentar.',
    more: 'Weitere Kommentare',
    retry: 'Erneut versuchen',
    loadError: 'Die Kommentare konnten gerade nicht geladen werden.',
    sendError: 'Ihr Kommentar konnte nicht veröffentlicht werden. Ihr Text wurde behalten; versuchen Sie es erneut.',
    slow: 'Sie haben zu viele Kommentare gesendet. Warten Sie eine Minute und versuchen Sie es erneut.',
    success: 'Ihr Kommentar ist eingegangen und erscheint nach Freigabe durch den Administrator.',
  },
  es: {
    title: 'Comentarios',
    intro: '¿Qué te ha evocado este poema? Comparte algunas ideas.',
    name: 'Tu nombre',
    body: 'Tu comentario',
    note: 'Tu nombre y tu comentario serán públicos tras la aprobación del administrador. Mantén un tono respetuoso, por favor.',
    send: 'Enviar comentario',
    sending: 'Enviando…',
    loading: 'Cargando comentarios…',
    empty: 'Sé el primero en dejar un comentario.',
    more: 'Más comentarios',
    retry: 'Reintentar',
    loadError: 'Ahora mismo no se pudieron cargar los comentarios.',
    sendError: 'No se pudo publicar tu comentario. Hemos conservado tu texto; inténtalo de nuevo.',
    slow: 'Has enviado demasiados comentarios. Espera un minuto y vuelve a intentarlo.',
    success: 'Hemos recibido tu comentario; aparecerá tras la aprobación del administrador.',
  },
  it: {
    title: 'Commenti',
    intro: 'Che cosa ti ha suscitato questa poesia? Condividi qualche pensiero.',
    name: 'Il tuo nome',
    body: 'Il tuo commento',
    note: 'Il tuo nome e il tuo commento saranno pubblici dopo l’approvazione dell’amministratore. Mantieni un tono rispettoso, per favore.',
    send: 'Invia il commento',
    sending: 'Invio in corso…',
    loading: 'Caricamento dei commenti…',
    empty: 'Sii il primo a lasciare un commento.',
    more: 'Altri commenti',
    retry: 'Riprova',
    loadError: 'Al momento non è stato possibile caricare i commenti.',
    sendError: 'Non è stato possibile pubblicare il tuo commento. Il tuo testo è stato conservato; riprova.',
    slow: 'Hai inviato troppi commenti. Attendi un minuto e riprova.',
    success: 'Abbiamo ricevuto il tuo commento; apparirà dopo l’approvazione dell’amministratore.',
  },
};

export default function PoemComments({
  poemId,
  language,
  onCountChange,
}: {
  poemId: string;
  language: SiteLanguage;
  onCountChange?: (poemId: string, total: number) => void;
}) {
  const updateCount = useCallback((total: number) => onCountChange?.(poemId, total), [poemId, onCountChange]);
  return (
    <ReaderComments
      key={poemId}
      endpoint={`/api/poems/${poemId}/comments`}
      language={language}
      onCountChange={updateCount}
    />
  );
}

export function ReaderComments({
  endpoint,
  language,
  intro,
  onCountChange,
}: {
  endpoint: string;
  language: SiteLanguage;
  intro?: string;
  onCountChange?: (total: number) => void;
}) {
  return (
    <CommentForm key={endpoint} endpoint={endpoint} language={language} intro={intro} onCountChange={onCountChange} />
  );
}
function CommentForm({
  endpoint,
  language,
  intro,
  onCountChange,
}: {
  endpoint: string;
  language: SiteLanguage;
  intro?: string;
  onCountChange?: (total: number) => void;
}) {
  const labels = copy[language];
  const id = useId();
  const [total, setTotal] = useState<number | null>(null);
  const [comments, setComments] = useState<ReaderComment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const recovery = useCommentDraft(endpoint);
  const { name, content } = recovery.draft;
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<'sendError' | 'slow' | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    if (!sending && (recovery.available || (!name && !content))) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending, recovery.available, name, content]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?offset=${offset}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Comments unavailable');
        const data = (await response.json()) as { comments: ReaderComment[]; hasMore: boolean; total?: number };
        if (controller.signal.aborted) return;
        setComments(previous =>
          offset === 0
            ? data.comments
            : [...previous, ...data.comments.filter(comment => !previous.some(item => item.id === comment.id))],
        );
        if (typeof data.total === 'number') {
          setTotal(data.total);
          onCountChange?.(data.total);
        }
        setHasMore(data.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [endpoint, offset, reload, onCountChange]);

  function load(nextOffset: number) {
    setLoading(true);
    setLoadFailed(false);
    setOffset(nextOffset);
    setReload(value => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !name.trim() || !content.trim()) return;
    pending.current = true;
    setSending(true);
    setSendError(null);
    setSaved(false);
    try {
      // Reuse the request ID after a lost response to avoid posting twice.
      const attempt = recovery.attempt();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        setSendError(response.status === 429 ? 'slow' : 'sendError');
        return;
      }
      const data = (await response.json()) as { received?: boolean };
      if (!data.received) throw new Error('Receipt unavailable');
      recovery.clear();
      setSaved(true);
      load(0);
    } catch {
      setSendError('sendError');
    } finally {
      pending.current = false;
      setSending(false);
    }
  }

  return (
    <section className="poem-comments" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{total === null ? labels.title : commentCountLabel(total, language)}</h2>
      <p className="comments-intro">{intro ?? labels.intro}</p>
      <form onSubmit={submit} className="comment-form" aria-describedby={`${id}-note`}>
        <label htmlFor={`${id}-name`}>{labels.name}</label>
        <input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          required
          maxLength={COMMENT_NAME_LIMIT}
          value={name}
          disabled={sending || !recovery.ready}
          onChange={event => {
            recovery.change({ name: event.target.value });
            setSaved(false);
          }}
        />
        <label htmlFor={`${id}-content`}>{labels.body}</label>
        <textarea
          id={`${id}-content`}
          name="comment"
          rows={4}
          required
          maxLength={COMMENT_BODY_LIMIT}
          value={content}
          disabled={sending || !recovery.ready}
          onChange={event => {
            recovery.change({ content: event.target.value });
            setSaved(false);
          }}
          aria-describedby={`${id}-length`}
        />
        <span id={`${id}-length`} className="comment-length">
          {content.length} / {COMMENT_BODY_LIMIT}
        </span>
        <p id={`${id}-note`} className="comment-note">
          {labels.note}
        </p>
        <button type="submit" className="primary-button" disabled={sending || !name.trim() || !content.trim()}>
          {sending ? labels.sending : labels.send}
        </button>
        {(name || content) && (
          <>
            <p className="comment-note" role="status">
              {recovery.available
                ? pick(
                    language,
                    'Schița se păstrează în această filă la schimbarea limbii și reîncărcare, cel mult 24 de ore.',
                    'The draft survives language changes and reloads in this tab for up to 24 hours.',
                    'Le brouillon reste dans cet onglet malgré les changements de langue et les rechargements, pendant 24 heures au plus.',
                    'Der Entwurf bleibt bei Sprachwechsel und Neuladen in diesem Tab bis zu 24 Stunden erhalten.',
                    'El borrador se conserva en esta pestaña, aunque cambies de idioma o recargues, durante 24 horas como máximo.',
                    'La bozza resta in questa scheda, anche se cambi lingua o ricarichi, per al massimo 24 ore.',
                  )
                : pick(
                    language,
                    'Browserul nu permite păstrarea schiței. Copiază textul înainte de a părăsi pagina.',
                    'This browser cannot save the draft. Copy your text before leaving this page.',
                    'Ce navigateur ne peut pas enregistrer le brouillon. Copiez votre texte avant de quitter cette page.',
                    'Dieser Browser kann den Entwurf nicht speichern. Kopieren Sie Ihren Text, bevor Sie die Seite verlassen.',
                    'Este navegador no puede guardar el borrador. Copia tu texto antes de salir de esta página.',
                    'Questo browser non può salvare la bozza. Copia il tuo testo prima di lasciare questa pagina.',
                  )}
            </p>
            <button
              type="button"
              className="secondary-button"
              disabled={sending}
              onClick={() => {
                if (
                  window.confirm(
                    pick(
                      language,
                      'Ștergi numele și comentariul netrimis?',
                      'Discard the name and unsent comment?',
                      'Effacer le nom et le commentaire non envoyé\u00a0?',
                      'Namen und nicht gesendeten Kommentar verwerfen?',
                      '¿Descartar el nombre y el comentario sin enviar?',
                      'Eliminare il nome e il commento non inviato?',
                    ),
                  )
                ) {
                  recovery.clear();
                  setSendError(null);
                  setSaved(false);
                }
              }}
            >
              {pick(
                language,
                'Abandonează schița',
                'Discard draft',
                'Effacer le brouillon',
                'Entwurf verwerfen',
                'Descartar el borrador',
                'Elimina la bozza',
              )}
            </button>
          </>
        )}
        {sendError && (
          <p role="alert" className="comment-error">
            {labels[sendError]}
          </p>
        )}
        <p role="status" className="comment-status">
          {saved ? labels.success : ''}
        </p>
      </form>
      {comments.length > 0 && (
        <ol className="comment-list">
          {comments.map(comment => (
            <li key={comment.id}>
              <div className="comment-meta">
                <strong dir="auto">{comment.name}</strong>
                <time dateTime={new Date(comment.created_at).toISOString()}>
                  {new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(comment.created_at)}
                </time>
              </div>
              <p dir="auto">{comment.content}</p>
            </li>
          ))}
        </ol>
      )}
      {loading && (
        <p role="status" className="comment-note">
          {labels.loading}
        </p>
      )}
      {loadFailed && (
        <div role="alert">
          <p>{labels.loadError}</p>
          <button className="secondary-button" onClick={() => load(offset)}>
            {labels.retry}
          </button>
        </div>
      )}
      {!loading && !loadFailed && !comments.length && <p className="comment-note">{labels.empty}</p>}
      {hasMore && !loadFailed && (
        <button className="secondary-button" disabled={loading} onClick={() => load(offset + 20)}>
          {labels.more}
        </button>
      )}
    </section>
  );
}
