'use client';

import { useEffect, useRef, useState } from 'react';
import { AUDIO_ACCEPT, MAX_AUDIO_BYTES, audioFileType, type AudioField } from '@/lib/poem-audio';
import './audio-upload-field.css';

export type SelectedAudio = { file: File; id: string };

function AudioPreview({ selected, storedId, label }: { selected: SelectedAudio | null; storedId: string | null; label: string }) {
  const element = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const audio = element.current;
    if (!audio) return;
    const localUrl = selected ? URL.createObjectURL(selected.file) : null;
    audio.src = localUrl || `/api/audio/${storedId}`;
    return () => {
      audio.pause(); audio.removeAttribute('src'); audio.load();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [selected, storedId]);
  return <><audio ref={element} controls preload="metadata" aria-label={`Previzualizare audio — ${label}`} onError={() => setFailed(true)} />{failed && <p className="audio-upload-error" role="alert">Browserul nu poate reda acest fișier. Verifică înregistrarea sau încearcă un MP3.</p>}</>;
}

export default function AudioUploadField({ field, label, selected, storedId, disabled, onSelect, onRemove }: {
  field: AudioField; label: string; selected: SelectedAudio | null; storedId: string | null; disabled: boolean;
  onSelect: (value: SelectedAudio) => void; onRemove: () => void;
}) {
  const [error, setError] = useState('');
  function choose(file: File | undefined) {
    if (!file || disabled) return;
    setError('');
    if (!audioFileType(file)) { setError('Alege un fișier MP3, WAV, M4A sau OGG.'); return; }
    if (!file.size) { setError('Fișierul este gol. Alege o înregistrare audio.'); return; }
    if (file.size > MAX_AUDIO_BYTES) { setError('Înregistrarea depășește limita de 25 MB. Alege un fișier mai mic.'); return; }
    onSelect({ file, id: crypto.randomUUID() });
  }
  return <div className="audio-upload-field">
    <label htmlFor={field}>Înregistrare — {label} <span className="optional-label">(opțional)</span></label>
    <input id={field} type="file" accept={AUDIO_ACCEPT} disabled={disabled} aria-describedby={`${field}-help`} onChange={event => { choose(event.target.files?.[0]); event.target.value = ''; }} />
    <p id={`${field}-help`} className="field-help">MP3, WAV, M4A sau OGG, maximum 25 MB. Fișierul se încarcă la salvarea poemului.</p>
    <p className="field-help">{selected ? `${selected.file.name} · nesalvat` : storedId ? 'Înregistrare salvată.' : 'Nicio înregistrare încărcată.'}</p>
    {(selected || storedId) && <>
      <AudioPreview key={selected?.id || storedId} selected={selected} storedId={storedId} label={label} />
      <button type="button" className="text-button" disabled={disabled} onClick={() => { setError(''); onRemove(); }}>Elimină înregistrarea</button>
    </>}
    {error && <p className="audio-upload-error" role="alert">{error}</p>}
  </div>;
}
