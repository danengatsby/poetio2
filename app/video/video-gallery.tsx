'use client';
import { contentPath } from '@/lib/content-metadata';
import '../content-detail.css';
import SiteLogo from '../site-logo';
// Use document navigation with the shared header.
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { videoPosterPath, type VideoWithCommentCount } from '@/lib/video-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import VideoPlayer from './video-player';
import VideoCover from './video-cover';
import { ReaderComments } from '../poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import './video.css';

export default function VideoGallery({ videos, initialLanguage, canAdmin, failed = false }: { videos: VideoWithCommentCount[]; initialLanguage: PoemLanguage; canAdmin: boolean; failed?: boolean }) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const trigger = useRef<HTMLButtonElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const ro = language === 'ro';
  const copy = siteCopy[language];
  const current = active === null ? null : videos[active];
  const currentId = current?.id;
  const updateCommentCount = useCallback((total: number) => {
    if (!currentId) return;
    setCommentCounts(previous => previous[currentId] === total ? previous : { ...previous, [currentId]: total });
  }, [currentId]);
  const countLabel = (video: VideoWithCommentCount) => commentCountLabel(commentCounts[video.id] ?? video.comment_count, language);
  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  function navigate(delta: number) {
    setActive(value => Math.max(0, Math.min(videos.length - 1, (value ?? 0) + delta)));
    if (reader.current) reader.current.scrollTop = 0;
    requestAnimationFrame(() => title.current?.focus());
  }
  return <>
    <a className="skip-link" href="#main">{ro ? 'Mergi la videouri' : 'Skip to videos'}</a>
    <SiteHeader language={language} onLanguageChange={changeLanguage} videoPage />
    <main id="main" className="video-main shell" lang={language}>
      <div className="video-intro">
        <SiteLogo />
      </div>
      <div className="section-heading"><div><p className="eyebrow">{ro ? 'Povești în mișcare' : 'Stories in motion'}</p><h1>Video<span className="count">({String(videos.length).padStart(2, '0')})</span></h1></div><p>{ro ? 'Un răgaz pentru imagini și cuvinte.' : 'A moment for images and words.'}</p></div>
      {failed ? <div className="collection-empty" role="alert"><p>{ro ? 'Videourile nu pot fi încărcate momentan.' : 'Videos could not be loaded right now.'}</p><a className="secondary-button" href={withSiteLanguage('/video', language)}>{copy.retry}</a></div> : videos.length ? <div className="poem-grid video-grid">{videos.map((video, index) => <div key={video.id} className="collection-item"><button className="poem-card video-card" onClick={event => { trigger.current = event.currentTarget; setActive(index); }} aria-label={`${ro ? 'Redă' : 'Play'}: ${video.title} · ${countLabel(video)}`}>
        <VideoCover key={video.file_id} fileId={video.file_id} />
        <span className="card-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>Video</span></span>
        <h2>{video.title}</h2><p>{video.description || (ro ? 'Deschide pentru a viziona.' : 'Open to watch.')}</p>
        <span className="card-bottom"><span>{video.author || 'Poetio'}<span className="card-comment-count">{countLabel(video)}</span></span><span aria-hidden="true">↗</span></span>
      </button><a className="content-page-link" href={withSiteLanguage(contentPath('video',video.id),language)}>{ro?'Pagina videoului ↗':'Video page ↗'}</a></div>)}</div> : <div className="collection-empty"><p>{ro ? 'Primul video va apărea aici în curând.' : 'The first video will appear here soon.'}</p>{canAdmin && <a className="primary-button" href="/admin/video">{ro ? 'Adaugă primul video' : 'Add the first video'}</a>}</div>}
    </main>
    <footer className="site-footer shell"><a href={withSiteLanguage('/', language)} className="wordmark">Poetio<span aria-hidden="true">✳</span></a><p>{copy.footer}</p><a href="#" className="back-top">{copy.back} ↑</a></footer>
    <Dialog open={active !== null} onOpenChange={value => { if (!value) setActive(null); }}>
      <DialogContent ref={reader} className="poetry-reader video-reader" showCloseButton={false} onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        {current && <>
          <div className="reader-top"><span className="reader-brand">Poetio<span aria-hidden="true">✳</span></span><DialogClose className="reader-close" aria-label={ro ? 'Închide videoul' : 'Close video'}>×</DialogClose></div>
          <article className="video-article"><DialogTitle ref={title} tabIndex={-1} className="reader-title">{current.title}</DialogTitle>{current.author && <p className="reader-author">{current.author}</p>}
            <VideoPlayer key={`${current.id}:${current.file_id}`} src={`/api/video-files/${current.file_id}`} poster={videoPosterPath(current.file_id)} title={current.title} language={language} />
            <DialogDescription className="video-description">{current.description || (ro ? 'Video din colecția Poetio.' : 'A video from the Poetio collection.')}</DialogDescription>
          </article>
          <a className="content-page-link" href={withSiteLanguage(contentPath('video',current.id),language)}>{ro?'Deschide pagina videoului ↗':'Open video page ↗'}</a>
          <ReaderComments key={current.id} endpoint={`/api/videos/${current.id}/comments`} language={language} onCountChange={updateCommentCount} intro={ro ? 'Ce ți-a transmis acest video? Lasă câteva gânduri.' : 'What did this video bring to mind? Share a few thoughts.'} />
          <div className="reader-navigation"><button disabled={active === 0} onClick={() => navigate(-1)}>{copy.previous}</button><span aria-live="polite">{(active ?? 0) + 1} / {videos.length}</span><button disabled={active === videos.length - 1} onClick={() => navigate(1)}>{ro ? 'Următorul →' : 'Next video →'}</button></div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
