'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PoemLanguage, SiteLanguage } from '@/lib/poem-types';
import { pick } from '@/lib/site-language';
import './poem-audio-player.css';

export default function PoemAudioPlayer({
  audioId,
  src,
  title,
  language,
  recording,
  showStatus = false,
}: {
  audioId: string | null;
  src?: string;
  title: string;
  /** The site language, for the labels. */
  language: SiteLanguage;
  /** The language of the recording (the French page plays the original's). */
  recording: PoemLanguage;
  showStatus?: boolean;
}) {
  const id = useId();
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const source = src || (audioId ? `/api/audio/${audioId}` : undefined);
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
        aria-label={`${pick(language, 'Ascultă: ', 'Listen to: ', 'Écouter\u00a0: ', 'Anhören: ')}${title}`}
        aria-disabled={!source || undefined}
        aria-describedby={!source || failed ? `${id}-status` : undefined}
        onLoadedMetadata={() => {
          setFailed(false);
          setReady(true);
        }}
        onError={() => {
          if (source) setFailed(true);
        }}
      />
      {showStatus && source && !failed && (
        <p role="status">
          {ready
            ? pick(
                language,
                'Audio încărcat. Ascultă pentru a verifica înregistrarea.',
                'Audio loaded. Play it to check the recording.',
                'Audio chargé. Écoutez-le pour vérifier l’enregistrement.',
                'Audio geladen. Spielen Sie es ab, um die Aufnahme zu prüfen.',
              )
            : pick(
                language,
                'Se verifică încărcarea audio…',
                'Loading audio…',
                'Chargement de l’audio…',
                'Audio wird geladen…',
              )}
        </p>
      )}
      {!source && (
        <p id={`${id}-status`} className="poem-audio-status">
          {pick(
            language,
            `Înregistrarea în ${recording === 'ro' ? 'română' : 'engleză'} nu a fost încă adăugată.`,
            `${recording === 'ro' ? 'A Romanian' : 'An English'} recording has not been added yet.`,
            `L’enregistrement en ${recording === 'ro' ? 'roumain' : 'anglais'} n’a pas encore été ajouté.`,
            `Eine ${recording === 'ro' ? 'rumänische' : 'englische'} Aufnahme wurde noch nicht hinzugefügt.`,
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
          )}{' '}
          <a href={source} download>
            {pick(language, 'Descarcă audio', 'Download audio', 'Télécharger l’audio', 'Audio herunterladen')}
          </a>
        </p>
      )}
    </section>
  );
}
