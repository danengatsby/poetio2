'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

export default function VideoCover({ fileId }: { fileId: string }) {
  const element = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = element.current;
    if (!video) return;
    // Fetch only covers near the viewport. A tiny seek also reveals the first
    // frame in browsers that otherwise keep the video blank until playback.
    const load = () => { video.src = `/api/video-files/${fileId}#t=0.001`; video.load(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { load(); observer?.disconnect(); }
    }, { rootMargin: '200px' });
    if (observer) observer.observe(video);
    else load();
    return () => { observer?.disconnect(); video.pause(); video.removeAttribute('src'); video.load(); };
  }, [fileId]);

  return <span className={`video-cover${ready ? ' video-cover-ready' : ''}`} aria-hidden="true">
    <span className="video-cover-brand">Poetio<span>✳</span></span>
    <video ref={element} className="video-cover-frame" muted playsInline preload="metadata" tabIndex={-1}
      onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.currentTime === 0) video.currentTime = Number.isFinite(video.duration) ? Math.min(0.001, video.duration / 2) : 0.001;
      }}
      onLoadedData={() => setReady(true)} onSeeked={() => setReady(true)} onError={() => setReady(false)} />
    <span className="video-play"><Play size={30} /></span>
  </span>;
}
