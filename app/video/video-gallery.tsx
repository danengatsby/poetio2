'use client';
import { contentPath } from '@/lib/content-metadata';
import '../content-detail.css';
import SiteLogo from '../site-logo';
// Use document navigation with the shared header.
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { videoPosterPath, type VideoWithCommentCount } from '@/lib/video-types';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import VideoPlayer from './video-player';
import VideoCover from './video-cover';
import { ReaderComments } from '../poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import './video.css';
import LegalLinks from '../legal-links';

export default function VideoGallery({
  videos,
  initialLanguage,
  canAdmin,
  failed = false,
}: {
  videos: VideoWithCommentCount[];
  initialLanguage: SiteLanguage;
  canAdmin: boolean;
  failed?: boolean;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const trigger = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const copy = siteCopy[language];
  const current = active === null ? null : videos[active];
  const currentId = current?.id;
  const updateCommentCount = useCallback(
    (total: number) => {
      if (!currentId) return;
      setCommentCounts(previous => (previous[currentId] === total ? previous : { ...previous, [currentId]: total }));
    },
    [currentId],
  );
  const countLabel = (video: VideoWithCommentCount) =>
    commentCountLabel(commentCounts[video.id] ?? video.comment_count, language);
  function changeLanguage(value: SiteLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  function navigate(delta: number) {
    setActive(value => Math.max(0, Math.min(videos.length - 1, (value ?? 0) + delta)));
    if (reader.current) reader.current.scrollTop = 0;
    requestAnimationFrame(() => title.current?.focus());
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {pick(
          language,
          'Mergi la videouri',
          'Skip to videos',
          'Aller aux vidéos',
          'Zu den Videos springen',
          'Ir a los vídeos',
          'Vai ai video',
        )}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} videoPage />
      <main id="main" className="video-main shell" lang={language}>
        <div className="video-intro">
          <SiteLogo />
        </div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {pick(
                language,
                'Povești în mișcare',
                'Stories in motion',
                'Histoires en mouvement',
                'Geschichten in Bewegung',
                'Historias en movimiento',
                'Storie in movimento',
              )}
            </p>
            <h1>
              Video<span className="count">({String(videos.length).padStart(2, '0')})</span>
            </h1>
          </div>
          <p>
            {pick(
              language,
              'Un răgaz pentru imagini și cuvinte.',
              'A moment for images and words.',
              'Un moment pour les images et les mots.',
              'Ein Moment für Bilder und Worte.',
              'Un momento para las imágenes y las palabras.',
              'Un momento per le immagini e le parole.',
            )}
          </p>
        </div>
        {failed ? (
          <div className="collection-empty" role="alert">
            <p>
              {pick(
                language,
                'Videourile nu pot fi încărcate momentan.',
                'Videos could not be loaded right now.',
                'Les vidéos n’ont pas pu être chargées pour le moment.',
                'Die Videos konnten gerade nicht geladen werden.',
                'Ahora mismo no se pudieron cargar los vídeos.',
                'Al momento non è stato possibile caricare i video.',
              )}
            </p>
            <a className="secondary-button" href={withSiteLanguage('/video', language)}>
              {copy.retry}
            </a>
          </div>
        ) : videos.length ? (
          <div className="poem-grid video-grid">
            {videos.map((video, index) => (
              <div key={video.id} className="collection-item">
                <button
                  className="poem-card video-card"
                  onClick={event => {
                    trigger.current = event.currentTarget;
                    setActive(index);
                  }}
                  aria-label={`${pick(language, 'Redă', 'Play', 'Lire', 'Abspielen', 'Reproducir', 'Riproduci')}: ${video.title} · ${countLabel(video)}`}
                >
                  <VideoCover key={video.file_id} fileId={video.file_id} />
                  <span className="card-meta">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <span>{pick(language, 'Video', 'Video', 'Vidéo', 'Video', 'Vídeo', 'Video')}</span>
                  </span>
                  <h2>{video.title}</h2>
                  <p>
                    {video.description ||
                      pick(
                        language,
                        'Deschide pentru a viziona.',
                        'Open to watch.',
                        'Ouvrir pour regarder.',
                        'Zum Ansehen öffnen.',
                        'Abrir para ver.',
                        'Apri per guardare.',
                      )}
                  </p>
                  <span className="card-bottom">
                    <span>
                      {video.author || 'Poetio'}
                      <span className="card-comment-count">{countLabel(video)}</span>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </span>
                </button>
                <a className="content-page-link" href={withSiteLanguage(contentPath('video', video.id), language)}>
                  {pick(
                    language,
                    'Pagina videoului ↗',
                    'Video page ↗',
                    'Page de la vidéo ↗',
                    'Videoseite ↗',
                    'Página del vídeo ↗',
                    'Pagina del video ↗',
                  )}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="collection-empty">
            <p>
              {pick(
                language,
                'Primul video va apărea aici în curând.',
                'The first video will appear here soon.',
                'La première vidéo apparaîtra bientôt ici.',
                'Das erste Video erscheint bald hier.',
                'El primer vídeo aparecerá pronto aquí.',
                'Il primo video apparirà presto qui.',
              )}
            </p>
            {canAdmin && (
              <a className="primary-button" href="/admin/video">
                {pick(
                  language,
                  'Adaugă primul video',
                  'Add the first video',
                  'Ajouter la première vidéo',
                  'Das erste Video hinzufügen',
                  'Añadir el primer vídeo',
                  'Aggiungi il primo video',
                )}
              </a>
            )}
          </div>
        )}
      </main>
      <footer className="site-footer shell">
        <a href={withSiteLanguage('/', language)} className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <p>
          {copy.footer} · <LegalLinks language={language} />
        </p>
        <a href="#" className="back-top">
          {copy.back} ↑
        </a>
      </footer>
      <Dialog
        open={active !== null}
        onOpenChange={value => {
          if (!value) setActive(null);
        }}
      >
        <DialogContent
          ref={reader}
          className="poetry-reader video-reader"
          showCloseButton={false}
          onOpenAutoFocus={event => {
            event.preventDefault();
            title.current?.focus();
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          {current && (
            <>
              <div className="reader-top">
                <span className="reader-brand">
                  Poetio<span aria-hidden="true">✳</span>
                </span>
                <DialogClose
                  className="reader-close"
                  aria-label={pick(
                    language,
                    'Închide videoul',
                    'Close video',
                    'Fermer la vidéo',
                    'Video schließen',
                    'Cerrar el vídeo',
                    'Chiudi il video',
                  )}
                >
                  ×
                </DialogClose>
              </div>
              <article className="video-article">
                <DialogTitle ref={title} tabIndex={-1} className="reader-title">
                  {current.title}
                </DialogTitle>
                {current.author && <p className="reader-author">{current.author}</p>}
                <VideoPlayer
                  key={`${current.id}:${current.file_id}`}
                  src={`/api/video-files/${current.file_id}`}
                  poster={videoPosterPath(current.file_id)}
                  title={current.title}
                  language={language}
                />
                <DialogDescription className="video-description">
                  {current.description ||
                    pick(
                      language,
                      'Video din colecția Poetio.',
                      'A video from the Poetio collection.',
                      'Une vidéo de la collection Poetio.',
                      'Ein Video aus der Poetio-Sammlung.',
                      'Un vídeo de la colección Poetio.',
                      'Un video della collezione Poetio.',
                    )}
                </DialogDescription>
              </article>
              <a className="content-page-link" href={withSiteLanguage(contentPath('video', current.id), language)}>
                {pick(
                  language,
                  'Deschide pagina videoului ↗',
                  'Open video page ↗',
                  'Ouvrir la page de la vidéo ↗',
                  'Videoseite öffnen ↗',
                  'Abrir la página del vídeo ↗',
                  'Apri la pagina del video ↗',
                )}
              </a>
              <ReaderComments
                key={current.id}
                endpoint={`/api/videos/${current.id}/comments`}
                language={language}
                onCountChange={updateCommentCount}
                intro={pick(
                  language,
                  'Ce ți-a transmis acest video? Lasă câteva gânduri.',
                  'What did this video bring to mind? Share a few thoughts.',
                  'Qu’est-ce que cette vidéo vous a évoqué\u00a0? Partagez quelques pensées.',
                  'Woran hat Sie dieses Video erinnert? Teilen Sie ein paar Gedanken.',
                  '¿Qué te ha evocado este vídeo? Comparte algunas ideas.',
                  'Che cosa ti ha suscitato questo video? Condividi qualche pensiero.',
                )}
              />
              <div className="reader-navigation">
                <button disabled={active === 0} onClick={() => navigate(-1)}>
                  {copy.previous}
                </button>
                <span aria-live="polite">
                  {(active ?? 0) + 1} / {videos.length}
                </span>
                <button disabled={active === videos.length - 1} onClick={() => navigate(1)}>
                  {pick(
                    language,
                    'Următorul →',
                    'Next video →',
                    'Vidéo suivante →',
                    'Nächstes Video →',
                    'Vídeo siguiente →',
                    'Video successivo →',
                  )}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
