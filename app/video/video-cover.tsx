'use client';
/* eslint-disable @next/next/no-img-element -- A private, revalidated still from the server, without an image proxy. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { videoPosterPath } from '@/lib/video-types';

export default function VideoCover({ fileId }: { fileId: string }) {
  const element = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // A generated still is a few dozen kilobytes; the film's own first frame
  // costs far more. Fall back to the film only where no still is available.
  const [fromFilm, setFromFilm] = useState(false);
  // The still may finish, or fail, before React attaches its handlers.
  const still = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete) return;
    if (image.naturalWidth > 0) setReady(true); else setFromFilm(true);
  }, []);

  useEffect(() => {
    const video = element.current;
    if (!fromFilm || !video) return;
    // Fetch only covers near the viewport. A tiny seek also reveals the first
    // frame in browsers that otherwise keep the video blank until playback.
    const load = () => { video.src = `/api/video-files/${fileId}#t=0.001`; video.load(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { load(); observer?.disconnect(); }
    }, { rootMargin: '200px' });
    if (observer) observer.observe(video);
    else load();
    return () => { observer?.disconnect(); video.pause(); video.removeAttribute('src'); video.load(); };
  }, [fileId, fromFilm]);

  return <span className={`video-cover${ready ? ' video-cover-ready' : ''}`} aria-hidden="true">
    <span className="video-cover-brand">Poetio<span>✳</span></span>
    {fromFilm ? <video ref={element} className="video-cover-frame" muted playsInline preload="metadata" tabIndex={-1}
      onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.currentTime === 0) video.currentTime = Number.isFinite(video.duration) ? Math.min(0.001, video.duration / 2) : 0.001;
      }}
      onLoadedData={() => setReady(true)} onSeeked={() => setReady(true)} onError={() => setReady(false)} />
      : <img ref={still} className="video-cover-frame" src={videoPosterPath(fileId)} alt="" loading="lazy" decoding="async"
        onLoad={() => setReady(true)} onError={() => { setReady(false); setFromFilm(true); }} />}
    <span className="video-play"><Play size={30} /></span>
  </span>;
}
