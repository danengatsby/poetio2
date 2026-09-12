'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';
import type { PoemLanguage } from '@/lib/poem-types';
import './poem-audio-player.css';

export default function PoemAudioPlayer({ audioId, title, language }: { audioId: string | null; title: string; language: PoemLanguage }) {
  const id = useId();
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const romanian = language === 'ro';
  useEffect(() => {
    const audio = element.current;
    if (audio && audioId) audio.src = `/api/audio/${audioId}`;
    const stop = () => audio?.pause();
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      audio?.pause(); audio?.removeAttribute('src'); audio?.load();
    };
  }, [audioId]);
  return <section className="poem-audio-player" aria-labelledby={`${id}-heading`}>
    <div className="poem-audio-heading"><Headphones size={22} aria-hidden="true" /><div><h3 id={`${id}-heading`}>{romanian ? 'Ascultă poemul' : 'Listen to the poem'}</h3><p>{romanian ? 'Înregistrare audio' : 'Audio recording'}</p></div></div>
    <audio ref={element} controls preload="metadata" src={audioId ? `/api/audio/${audioId}` : undefined} aria-label={`${romanian ? 'Ascultă' : 'Listen to'}: ${title}`} aria-disabled={!audioId || undefined} aria-describedby={!audioId || failed ? `${id}-status` : undefined} onLoadedMetadata={() => setFailed(false)} onError={() => { if (audioId) setFailed(true); }} />
    {!audioId && <p id={`${id}-status`} className="poem-audio-status">{romanian ? 'Înregistrarea în română nu a fost încă adăugată.' : 'An English recording has not been added yet.'}</p>}
    {audioId && failed && <p id={`${id}-status`} className="poem-audio-status" role="alert">{romanian ? 'Înregistrarea nu poate fi redată. Reîncearcă sau descarcă fișierul.' : 'This recording cannot be played. Try again or download the file.'} <a href={`/api/audio/${audioId}`} download>{romanian ? 'Descarcă audio' : 'Download audio'}</a></p>}
  </section>;
}
