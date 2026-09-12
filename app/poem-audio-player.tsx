'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';
import type { PoemLanguage } from '@/lib/poem-types';
import './poem-audio-player.css';

export default function PoemAudioPlayer({ audioId, title, language }: { audioId: string; title: string; language: PoemLanguage }) {
  const id = useId();
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const romanian = language === 'ro';
  useEffect(() => {
    const audio = element.current;
    if (audio) audio.src = `/api/audio/${audioId}`;
    const stop = () => audio?.pause();
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      audio?.pause(); audio?.removeAttribute('src'); audio?.load();
    };
  }, [audioId]);
  return <section className="poem-audio-player" aria-labelledby={`${id}-heading`}>
    <div className="poem-audio-heading"><Headphones size={22} aria-hidden="true" /><div><h3 id={`${id}-heading`}>{romanian ? 'Ascultă poemul' : 'Listen to the poem'}</h3><p>{romanian ? 'Înregistrare audio' : 'Audio recording'}</p></div></div>
    <audio ref={element} controls preload="metadata" src={`/api/audio/${audioId}`} aria-label={`${romanian ? 'Ascultă' : 'Listen to'}: ${title}`} onLoadedMetadata={() => setFailed(false)} onError={() => setFailed(true)} />
    {failed && <p className="poem-audio-status" role="alert">{romanian ? 'Înregistrarea nu poate fi redată. Reîncearcă sau descarcă fișierul.' : 'This recording cannot be played. Try again or download the file.'} <a href={`/api/audio/${audioId}`} download>{romanian ? 'Descarcă audio' : 'Download audio'}</a></p>}
  </section>;
}
