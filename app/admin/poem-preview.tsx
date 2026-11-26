'use client';
import { useEffect, useState } from 'react';
import { type PoemInput, type SiteLanguage } from '@/lib/poem-types';
import { poemRecording, poemVersion } from '@/lib/poem-languages';
import PoemReading, { type ReadablePoem } from '../poem-reading';
import type { SelectedAudio } from './audio-upload-field';
import { audioField, type AudioField } from '@/lib/poem-audio';
import ReaderPreview from './reader-preview';

function LocalAudioPoem({ poem, language, file }: { poem: ReadablePoem; language: SiteLanguage; file?: File }) {
  const [url] = useState(() => (file ? URL.createObjectURL(file) : undefined));
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return <PoemReading poem={poem} language={language} audioSrc={url} mediaStatus />;
}
export default function PoemPreview({
  draft,
  audio,
  disabled,
  translationPending,
}: {
  draft: PoemInput;
  audio: Record<AudioField, SelectedAudio | null>;
  disabled: boolean;
  translationPending: boolean;
}) {
  const poem: ReadablePoem = {
    ...draft,
    source_language: draft.source_language || 'ro',
    translated_title: draft.translated_title ?? null,
    translated_theme: draft.translated_theme ?? null,
    translated_content: draft.translated_content ?? null,
    fr_title: draft.fr_title ?? null,
    fr_theme: draft.fr_theme ?? null,
    fr_content: draft.fr_content ?? null,
    de_title: draft.de_title ?? null,
    de_theme: draft.de_theme ?? null,
    de_content: draft.de_content ?? null,
    es_title: draft.es_title ?? null,
    es_theme: draft.es_theme ?? null,
    es_content: draft.es_content ?? null,
    it_title: draft.it_title ?? null,
    it_theme: draft.it_theme ?? null,
    it_content: draft.it_content ?? null,
    audio_ro_id: audio.audio_ro_id?.id ?? draft.audio_ro_id ?? null,
    audio_en_id: audio.audio_en_id?.id ?? draft.audio_en_id ?? null,
    audio_fr_id: audio.audio_fr_id?.id ?? draft.audio_fr_id ?? null,
    audio_de_id: audio.audio_de_id?.id ?? draft.audio_de_id ?? null,
    audio_es_id: audio.audio_es_id?.id ?? draft.audio_es_id ?? null,
    audio_it_id: audio.audio_it_id?.id ?? draft.audio_it_id ?? null,
  };
  return (
    <ReaderPreview
      disabled={disabled}
      note={
        <>
          <p>
            {translationPending
              ? 'Se afișează traducerea completată acum în editor. Pentru traducerea automată, folosește mai întâi „Pregătește traducerea în schiță”, dacă este disponibilă.'
              : 'Originalul, traducerea și versiunile în franceză, germană, spaniolă și italiană din editor pot fi comparate cu selectorul RO/EN/FR/DE/ES/IT.'}
          </p>
          <p>Fișierele audio selectate sunt redate local. Previzualizarea nu le încarcă pe server.</p>
        </>
      }
    >
      {language => {
        const actual = poemVersion(poem, language) ? language : poem.source_language;
        const field = audioField(poemRecording(poem, actual).language);
        const selected = audio[field];
        return (
          <LocalAudioPoem
            key={`${actual}:${selected?.id || poem[field]}`}
            poem={poem}
            language={language}
            file={selected?.file}
          />
        );
      }}
    </ReaderPreview>
  );
}
