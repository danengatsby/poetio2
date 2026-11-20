'use client';
import { useEffect, useRef, useState } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import { pilotSubtitles } from '@/lib/video-types';

export default function VideoPlayer({ src, title, language = 'ro', showStatus = false, poster }: { src: string; title: string; language?: PoemLanguage; showStatus?: boolean; poster?: string }) {
  const element = useRef<HTMLVideoElement>(null);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const hasSubtitles = src === `/api/video-files/${pilotSubtitles.fileId}`;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = element.current;
    const pause = () => video?.pause();
    const syncSubtitles = () => setSubtitlesOn(video?.textTracks[0]?.mode === 'showing');
    video?.textTracks.addEventListener('change', syncSubtitles);
    window.addEventListener('pagehide', pause);
    return () => { window.removeEventListener('pagehide', pause); video?.textTracks.removeEventListener('change', syncSubtitles); video?.pause(); video?.removeAttribute('src'); video?.load(); };
  }, [src]);
  return <div className="video-player">
    <video ref={element} src={src} poster={poster} controls playsInline preload="metadata" aria-label={title} onError={() => setFailed(true)} onLoadedMetadata={event => { setFailed(false); setReady(true); setSubtitlesOn(event.currentTarget.textTracks[0]?.mode === 'showing'); }}>
      {hasSubtitles && <track kind="subtitles" srcLang="ro" label={language === 'ro' ? 'Română' : 'Romanian'} src={pilotSubtitles.path} />}
    </video>
    {hasSubtitles && !failed && <button type="button" className="secondary-button video-subtitles" aria-pressed={subtitlesOn} onClick={() => {
      const track = element.current?.querySelector('track')?.track;
      if (track) {
        track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
        setSubtitlesOn(track.mode === 'showing');
      }
    }}>{language === 'ro' ? 'Subtitrări în română' : 'Romanian subtitles'}</button>}
    {showStatus && !failed && <p role="status">{ready ? (language === 'ro' ? 'Fișier încărcat. Pornește redarea pentru a verifica imaginea și sunetul.' : 'File loaded. Play it to check the picture and sound.') : (language === 'ro' ? 'Se verifică încărcarea videoului…' : 'Checking video loading…')}</p>}
    {failed && <p role="alert">{language === 'ro' ? 'Videoul nu poate fi redat în acest browser. Încearcă alt browser sau descarcă fișierul.' : 'This video cannot be played in this browser. Try another browser or download the file.'} <a href={src} download>{language === 'ro' ? 'Descarcă video' : 'Download video'}</a></p>}
  </div>;
}
