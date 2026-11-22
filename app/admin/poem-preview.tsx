'use client';
import { useEffect, useState } from 'react';
import type { PoemInput, SiteLanguage } from '@/lib/poem-types';
import { poemVersion } from '@/lib/poem-languages';
import PoemReading, { type ReadablePoem } from '../poem-reading';
import type { SelectedAudio } from './audio-upload-field';
import type { AudioField } from '@/lib/poem-audio';
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
    audio_ro_id: draft.audio_ro_id ?? null,
    audio_en_id: draft.audio_en_id ?? null,
  };
  return (
    <ReaderPreview
      disabled={disabled}
      note={
        <>
          <p>
            {translationPending
              ? 'Se afișează traducerea completată acum în editor. Pentru traducerea automată, folosește mai întâi „Pregătește traducerea în schiță”, dacă este disponibilă.'
              : 'Originalul, traducerea și versiunea în franceză din editor pot fi comparate cu selectorul RO/EN/FR.'}
          </p>
          <p>Fișierele audio selectate sunt redate local. Previzualizarea nu le încarcă pe server.</p>
        </>
      }
    >
      {language => {
        const actual = poemVersion(poem, language) ? language : poem.source_language;
        // As on the site: the French version plays the original's recording.
        const field = (actual === 'fr' ? poem.source_language : actual) === 'ro' ? 'audio_ro_id' : 'audio_en_id';
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
