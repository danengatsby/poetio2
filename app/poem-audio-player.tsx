'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick } from '@/lib/site-language';
import './poem-audio-player.css';

export default function PoemAudioPlayer({
  audioId,
  src,
  title,
  language,
  recording,
  showStatus = false,
  compactControl = false,
}: {
  audioId: string | null;
  src?: string;
  title: string;
  /** The site language, for the labels. */
  language: SiteLanguage;
  /** Language of the selected recording, including an original-language fallback. */
  recording: SiteLanguage;
  showStatus?: boolean;
  compactControl?: boolean;
}) {
  const id = useId();
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const source = src || (audioId ? `/api/audio/${audioId}` : undefined);
  const recordingName = new Intl.DisplayNames([language], { type: 'language' }).of(recording);
  const playLabel = `${pick(language, 'Ascultă: ', 'Listen to: ', 'Écouter\u00a0: ', 'Anhören: ', 'Escuchar: ', 'Ascolta: ')}${title}${recording !== language ? ` (${recordingName})` : ''}`;
  useEffect(() => {
    const audio = element.current;
    if (audio && source) audio.src = source;
    const stop = () => audio?.pause();
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      audio?.pause();
      audio?.removeAttribute('src');
      audio?.load();
    };
  }, [source]);
  return (
    <section className="poem-audio-player" aria-label={`Audio: ${title}`}>
      <audio
        ref={element}
        controls
        preload="metadata"
        src={source}
        aria-label={playLabel}
        aria-disabled={!source || undefined}
        aria-describedby={!source || failed ? `${id}-status` : undefined}
        onPlay={compactControl ? () => setPlaying(true) : undefined}
        onPause={compactControl ? () => setPlaying(false) : undefined}
        onLoadedMetadata={() => {
          setFailed(false);
          setReady(true);
        }}
        onError={() => {
          if (source) setFailed(true);
        }}
      />
      {compactControl && source && (
        <button
          type="button"
          className="poem-audio-toggle"
          aria-label={
            playing ? `${pick(language, 'Pauză', 'Pause', 'Pause', 'Pause', 'Pausa', 'Pausa')} · ${title}` : playLabel
          }
          onClick={() => {
            const audio = element.current;
            if (!audio) return;
            if (!audio.paused) audio.pause();
            else
              void audio.play().catch((error: Error) => {
                if (error.name !== 'AbortError') setFailed(true);
              });
          }}
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
      )}
      {showStatus && source && !failed && (
        <p role="status">
          {ready
            ? pick(
                language,
                'Audio încărcat. Ascultă pentru a verifica înregistrarea.',
                'Audio loaded. Play it to check the recording.',
                'Audio chargé. Écoutez-le pour vérifier l’enregistrement.',
                'Audio geladen. Spielen Sie es ab, um die Aufnahme zu prüfen.',
                'Audio cargado. Reprodúcelo para comprobar la grabación.',
                'Audio caricato. Riproducilo per controllare la registrazione.',
              )
            : pick(
                language,
                'Se verifică încărcarea audio…',
                'Loading audio…',
                'Chargement de l’audio…',
                'Audio wird geladen…',
                'Cargando el audio…',
                'Caricamento dell’audio…',
              )}
        </p>
      )}
      {!source && (
        <p id={`${id}-status`} className="poem-audio-status">
          {pick(
            language,
            `Înregistrare indisponibilă (${recordingName}).`,
            `Recording unavailable (${recordingName}).`,
            `Enregistrement indisponible (${recordingName}).`,
            `Aufnahme nicht verfügbar (${recordingName}).`,
            `Grabación no disponible (${recordingName}).`,
            `Registrazione non disponibile (${recordingName}).`,
          )}
        </p>
      )}
      {source && failed && (
        <p id={`${id}-status`} className="poem-audio-status" role="alert">
          {pick(
            language,
            'Înregistrarea nu poate fi redată. Reîncearcă sau descarcă fișierul.',
            'This recording cannot be played. Try again or download the file.',
            'Cet enregistrement ne peut pas être lu. Réessayez ou téléchargez le fichier.',
            'Diese Aufnahme kann nicht abgespielt werden. Versuchen Sie es erneut oder laden Sie die Datei herunter.',
            'Esta grabación no se puede reproducir. Inténtalo de nuevo o descarga el archivo.',
            'Questa registrazione non può essere riprodotta. Riprova o scarica il file.',
          )}{' '}
          <a href={source} download>
            {pick(
              language,
              'Descarcă audio',
              'Download audio',
              'Télécharger l’audio',
              'Audio herunterladen',
              'Descargar el audio',
              'Scarica l’audio',
            )}
          </a>
        </p>
      )}
    </section>
  );
}
