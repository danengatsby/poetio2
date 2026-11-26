'use client';
import { useEffect, useRef, useState } from 'react';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick } from '@/lib/site-language';

export default function VideoPlayer({
  src,
  title,
  language = 'ro',
  showStatus = false,
  poster,
  subtitleSrc,
  subtitleLanguage = 'ro',
  previewText,
}: {
  src: string;
  title: string;
  language?: SiteLanguage;
  showStatus?: boolean;
  poster?: string;
  subtitleSrc?: string;
  subtitleLanguage?: string;
  previewText?: string;
}) {
  const element = useRef<HTMLVideoElement>(null);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const hasSubtitles = Boolean(subtitleSrc || previewText);
  const trackRef = useRef<HTMLTrackElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !previewText) return;
    const url = URL.createObjectURL(new Blob([previewText], { type: 'text/vtt' }));
    track.src = url;
    return () => URL.revokeObjectURL(url);
  }, [previewText]);
  const trackLabel = new Intl.DisplayNames([language], { type: 'language' }).of(subtitleLanguage) || subtitleLanguage;
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
          <track kind="subtitles" ref={trackRef} srcLang={subtitleLanguage} label={trackLabel} src={subtitleSrc} />
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
          {pick(language, 'Subtitrări', 'Subtitles', 'Sous-titres', 'Untertitel', 'Subtítulos', 'Sottotitoli')} ·{' '}
          {trackLabel}
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
                'Datei geladen. Spielen Sie sie ab, um Bild und Ton zu prüfen.',
                'Archivo cargado. Reprodúcelo para comprobar la imagen y el sonido.',
                'File caricato. Riproducilo per controllare immagine e suono.',
              )
            : pick(
                language,
                'Se verifică încărcarea videoului…',
                'Checking video loading…',
                'Vérification du chargement de la vidéo…',
                'Videoladen wird geprüft…',
                'Comprobando la carga del vídeo…',
                'Verifica del caricamento del video…',
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
            'Dieses Video kann in diesem Browser nicht abgespielt werden. Versuchen Sie einen anderen Browser oder laden Sie die Datei herunter.',
            'Este vídeo no se puede reproducir en este navegador. Prueba otro navegador o descarga el archivo.',
            'Questo video non può essere riprodotto in questo browser. Prova un altro browser o scarica il file.',
          )}{' '}
          <a href={src} download>
            {pick(
              language,
              'Descarcă video',
              'Download video',
              'Télécharger la vidéo',
              'Video herunterladen',
              'Descargar el vídeo',
              'Scarica il video',
            )}
          </a>
        </p>
      )}
    </div>
  );
}
