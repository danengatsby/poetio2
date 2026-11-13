'use client';
import { useEffect, useRef, useState } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';

export default function VideoPlayer({ src, title, language = 'ro', showStatus = false, poster }: { src: string; title: string; language?: PoemLanguage; showStatus?: boolean; poster?: string }) {
  const element = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = element.current;
    const pause = () => video?.pause();
    window.addEventListener('pagehide', pause);
    return () => { window.removeEventListener('pagehide', pause); video?.pause(); video?.removeAttribute('src'); video?.load(); };
  }, [src]);
  return <div className="video-player">
    <video ref={element} src={src} poster={poster} controls playsInline preload="metadata" aria-label={title} onError={() => setFailed(true)} onLoadedMetadata={() => { setFailed(false); setReady(true); }} />
    {showStatus && !failed && <p role="status">{ready ? (language === 'ro' ? 'Fișier încărcat. Pornește redarea pentru a verifica imaginea și sunetul.' : 'File loaded. Play it to check the picture and sound.') : (language === 'ro' ? 'Se verifică încărcarea videoului…' : 'Checking video loading…')}</p>}
    {failed && <p role="alert">{language === 'ro' ? 'Videoul nu poate fi redat în acest browser. Încearcă alt browser sau descarcă fișierul.' : 'This video cannot be played in this browser. Try another browser or download the file.'} <a href={src} download>{language === 'ro' ? 'Descarcă video' : 'Download video'}</a></p>}
  </div>;
}
