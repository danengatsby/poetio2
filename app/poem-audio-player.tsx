'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Headphones, Pause, Play, Square } from 'lucide-react';
import type { PoemLanguage } from '@/lib/poem-types';
import { languageVoices, PoemRecitation, speechSegments, type RecitationState } from '@/lib/poem-recitation';
import './poem-audio-player.css';

const copy = {
  ro: {
    heading: 'Ascultă poemul', subtitle: 'Recitare cu voce sintetică', play: 'Recită poemul', pause: 'Pauză', resume: 'Continuă', replay: 'Ascultă din nou', stop: 'Oprește',
    voice: 'Voce', speed: 'Viteză', progress: 'Progresul recitării', loading: 'Se încarcă vocile…', idle: 'Apasă pe redare pentru a asculta.', playing: 'Se recită…', paused: 'În pauză. La continuare, fragmentul întrerupt se reia.', ended: 'Recitarea s-a încheiat.',
    unsupported: 'Browserul nu oferă recitare vocală. Încearcă un browser care acceptă citirea cu voce.', noVoice: 'Nu este disponibilă o voce în română. Activează o voce română în setările de vorbire ale dispozitivului, apoi redeschide poemul.', error: 'Recitarea nu a putut continua. Alege altă voce sau încearcă din nou.',
  },
  'en-US': {
    heading: 'Listen to the poem', subtitle: 'Synthetic voice reading', play: 'Read aloud', pause: 'Pause', resume: 'Resume', replay: 'Listen again', stop: 'Stop',
    voice: 'Voice', speed: 'Speed', progress: 'Reading progress', loading: 'Loading voices…', idle: 'Press play to listen.', playing: 'Reading…', paused: 'Paused. Resuming repeats the interrupted passage.', ended: 'Reading complete.',
    unsupported: 'This browser does not offer speech playback. Try a browser that supports reading aloud.', noVoice: 'No English voice is available. Enable an English voice in your device’s speech settings, then reopen the poem.', error: 'The reading could not continue. Choose another voice or try again.',
  },
};

export default function PoemAudioPlayer({ title, content, language }: { title: string; content: string; language: PoemLanguage }) {
  const text = copy[language];
  const id = useId();
  const [support, setSupport] = useState<'loading' | 'ready' | 'unsupported'>('loading');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState('');
  const [rate, setRate] = useState(0.9);
  const [playback, setPlayback] = useState<RecitationState>({ status: 'idle', completed: 0 });
  const recital = useRef<PoemRecitation | null>(null);
  const segments = useMemo(() => speechSegments(title, content), [title, content]);
  const spokenLanguage = language === 'ro' ? 'ro-RO' : 'en-US';
  const available = languageVoices(voices, spokenLanguage);
  const selected = available.find(voice => voice.voiceURI === voiceId) || available[0];
  const active = playback.status === 'playing' || playback.status === 'paused';

  useEffect(() => {
    const supported = typeof window.SpeechSynthesisUtterance === 'function' && typeof window.speechSynthesis?.speak === 'function';
    const synth = supported ? window.speechSynthesis : null;
    const load = () => {
      try {
        setVoices(synth?.getVoices() || []);
        setSupport(synth ? 'ready' : 'unsupported');
      } catch { setSupport('unsupported'); }
    };
    synth?.addEventListener('voiceschanged', load);
    // Voices may only become available after the browser initializes its engine.
    const initialLoad = setTimeout(load, 0);
    const session = synth ? new PoemRecitation(synth, value => new SpeechSynthesisUtterance(value), segments, spokenLanguage, setPlayback) : null;
    recital.current = session;
    const leave = () => session?.stop();
    window.addEventListener('pagehide', leave);
    return () => {
      clearTimeout(initialLoad);
      synth?.removeEventListener('voiceschanged', load);
      window.removeEventListener('pagehide', leave);
      session?.dispose();
      recital.current = null;
    };
  }, [segments, spokenLanguage]);

  function togglePlayback() {
    if (playback.status === 'playing') recital.current?.pause();
    else if (selected) recital.current?.play(selected, rate);
  }

  const label = playback.status === 'playing' ? text.pause : playback.status === 'paused' ? text.resume : playback.status === 'ended' ? text.replay : text.play;
  const status = support === 'loading' ? text.loading : support === 'unsupported' ? text.unsupported : !selected ? text.noVoice : text[playback.status];
  const percent = segments.length ? Math.round(playback.completed / segments.length * 100) : 0;

  return <section className="poem-audio-player" aria-labelledby={`${id}-heading`}>
    <div className="poem-audio-heading"><Headphones size={22} aria-hidden="true" /><div><h3 id={`${id}-heading`}>{text.heading}</h3><p>{text.subtitle}</p></div></div>
    <div className="poem-audio-controls">
      <button type="button" className="poem-audio-play" disabled={support !== 'ready' || !selected} onClick={togglePlayback}>
        {playback.status === 'playing' ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />} {label}
      </button>
      <button type="button" className="poem-audio-stop" disabled={!active} onClick={() => recital.current?.stop()}><Square size={16} aria-hidden="true" /> {text.stop}</button>
    </div>
    <div className="poem-audio-settings">
      <div><label htmlFor={`${id}-voice`}>{text.voice}</label><select id={`${id}-voice`} value={selected?.voiceURI || ''} disabled={active || !selected} onChange={event => setVoiceId(event.target.value)}>
        {!selected && <option value="">—</option>}{available.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
      </select></div>
      <div><label htmlFor={`${id}-rate`}>{text.speed}</label><select id={`${id}-rate`} value={rate} disabled={active || !selected} onChange={event => setRate(Number(event.target.value))}>
        {[0.75, 0.9, 1, 1.1, 1.25].map(value => <option key={value} value={value}>{value}×</option>)}
      </select></div>
    </div>
    <div className="poem-audio-progress"><progress aria-label={text.progress} value={playback.completed} max={Math.max(1, segments.length)} /><span aria-hidden="true">{percent}%</span></div>
    <p className="poem-audio-status" role="status">{status}</p>
  </section>;
}
