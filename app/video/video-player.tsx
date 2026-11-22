'use client';
import { useEffect, useRef, useState } from 'react';
import type { SiteLanguage } from '@/lib/poem-types';
import { pilotSubtitles } from '@/lib/video-types';
import { pick } from '@/lib/site-language';

export default function VideoPlayer({
  src,
  title,
  language = 'ro',
  showStatus = false,
  poster,
}: {
  src: string;
  title: string;
  language?: SiteLanguage;
  showStatus?: boolean;
  poster?: string;
}) {
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
    return () => {
      window.removeEventListener('pagehide', pause);
      video?.textTracks.removeEventListener('change', syncSubtitles);
      video?.pause();
      video?.removeAttribute('src');
      video?.load();
    };
  }, [src]);
  return (
    <div className="video-player">
      <video
        ref={element}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        onError={() => setFailed(true)}
        onLoadedMetadata={event => {
          setFailed(false);
          setReady(true);
          setSubtitlesOn(event.currentTarget.textTracks[0]?.mode === 'showing');
        }}
      >
        {hasSubtitles && (
          <track
            kind="subtitles"
            srcLang="ro"
            label={pick(language, 'Română', 'Romanian', 'Roumain')}
            src={pilotSubtitles.path}
          />
        )}
      </video>
      {hasSubtitles && !failed && (
        <button
          type="button"
          className="secondary-button video-subtitles"
          aria-pressed={subtitlesOn}
          onClick={() => {
            const track = element.current?.querySelector('track')?.track;
            if (track) {
              track.mode = track.mode === 'showing' ? 'disabled' : 'showing';
              setSubtitlesOn(track.mode === 'showing');
            }
          }}
        >
          {pick(language, 'Subtitrări în română', 'Romanian subtitles', 'Sous-titres en roumain')}
        </button>
      )}
      {showStatus && !failed && (
        <p role="status">
          {ready
            ? pick(
                language,
                'Fișier încărcat. Pornește redarea pentru a verifica imaginea și sunetul.',
                'File loaded. Play it to check the picture and sound.',
                'Fichier chargé. Lancez la lecture pour vérifier l’image et le son.',
              )
            : pick(
                language,
                'Se verifică încărcarea videoului…',
                'Checking video loading…',
                'Vérification du chargement de la vidéo…',
              )}
        </p>
      )}
      {failed && (
        <p role="alert">
          {pick(
            language,
            'Videoul nu poate fi redat în acest browser. Încearcă alt browser sau descarcă fișierul.',
            'This video cannot be played in this browser. Try another browser or download the file.',
            'Cette vidéo ne peut pas être lue dans ce navigateur. Essayez un autre navigateur ou téléchargez le fichier.',
          )}{' '}
          <a href={src} download>
            {pick(language, 'Descarcă video', 'Download video', 'Télécharger la vidéo')}
          </a>
        </p>
      )}
    </div>
  );
}
