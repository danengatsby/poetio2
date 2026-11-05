'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PoemLanguage } from '@/lib/poem-types';
import './poem-audio-player.css';

export default function PoemAudioPlayer({ audioId, src, title, language, showStatus = false }: { audioId: string | null; src?: string; title: string; language: PoemLanguage; showStatus?: boolean }) {
  const id = useId();
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const romanian = language === 'ro';
  const source = src || (audioId ? `/api/audio/${audioId}` : undefined);
  useEffect(() => {
    const audio = element.current;
    if (audio && source) audio.src = source;
    const stop = () => audio?.pause();
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      audio?.pause(); audio?.removeAttribute('src'); audio?.load();
    };
  }, [source]);
  return <section className="poem-audio-player" aria-label={`Audio: ${title}`}>
    <audio ref={element} controls preload="metadata" src={source} aria-label={`${romanian ? 'Ascultă' : 'Listen to'}: ${title}`} aria-disabled={!source || undefined} aria-describedby={!source || failed ? `${id}-status` : undefined} onLoadedMetadata={() => { setFailed(false); setReady(true); }} onError={() => { if (source) setFailed(true); }} />
    {showStatus && source && !failed && <p role="status">{ready ? (romanian ? 'Audio încărcat. Ascultă pentru a verifica înregistrarea.' : 'Audio loaded. Play it to check the recording.') : (romanian ? 'Se verifică încărcarea audio…' : 'Loading audio…')}</p>}
    {!source && <p id={`${id}-status`} className="poem-audio-status">{romanian ? 'Înregistrarea în română nu a fost încă adăugată.' : 'An English recording has not been added yet.'}</p>}
    {source && failed && <p id={`${id}-status`} className="poem-audio-status" role="alert">{romanian ? 'Înregistrarea nu poate fi redată. Reîncearcă sau descarcă fișierul.' : 'This recording cannot be played. Try again or download the file.'} <a href={source} download>{romanian ? 'Descarcă audio' : 'Download audio'}</a></p>}
  </section>;
}
