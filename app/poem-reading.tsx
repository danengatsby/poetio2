'use client';
import type { Poem, SiteLanguage } from '@/lib/poem-types';
import { poemRecording, poemVersion } from '@/lib/poem-languages';
import PoemAudioPlayer from './poem-audio-player';
import usePoemReadingPreferences from './use-poem-reading-preferences';
import './poem-reading.css';
import { pick } from '@/lib/site-language';

export type ReadablePoem = Pick<
  Poem,
  | 'title'
  | 'author'
  | 'theme'
  | 'content'
  | 'source_language'
  | 'translated_title'
  | 'translated_theme'
  | 'translated_content'
  | 'fr_title'
  | 'fr_theme'
  | 'fr_content'
  | 'de_title'
  | 'de_theme'
  | 'de_content'
  | 'es_title'
  | 'es_theme'
  | 'es_content'
  | 'it_title'
  | 'it_theme'
  | 'it_content'
  | 'audio_ro_id'
  | 'audio_en_id'
>;
export default function PoemReading({
  poem,
  language,
  audioSrc,
  mediaStatus = false,
  children,
}: {
  poem: ReadablePoem;
  language: SiteLanguage;
  audioSrc?: string;
  mediaStatus?: boolean;
  children?: React.ReactNode;
}) {
  const version = poemVersion(poem, language),
    text = version ?? poem;
  const actualLanguage = version ? language : poem.source_language;
  const recording = poemRecording(poem, actualLanguage);
  const preferences = usePoemReadingPreferences();
  return (
    <article className="poem-reading" lang={language}>
      <p className="eyebrow" lang={actualLanguage}>
        {text.theme || pick(language, 'Poezie', 'Poetry', 'Poésie', 'Lyrik', 'Poesía', 'Poesia')}
      </p>
      <h1 lang={actualLanguage}>
        {text.title ||
          pick(language, 'Fără titlu', 'Untitled', 'Sans titre', 'Ohne Titel', 'Sin título', 'Senza titolo')}
      </h1>
      {poem.author && <p className="reader-author">{poem.author}</p>}
      {children}
      <PoemAudioPlayer
        key={audioSrc || recording.id}
        audioId={recording.id}
        src={audioSrc}
        title={text.title}
        language={language}
        recording={recording.language}
        showStatus={mediaStatus}
      />
      {!version && (
        <p className="original-language-note">
          {pick(
            language,
            'Traducerea nu este disponibilă; se afișează originalul.',
            'Translation unavailable; showing the original.',
            'Traduction indisponible\u00a0; voici l’original.',
            'Übersetzung nicht verfügbar; das Original wird angezeigt.',
            'Traducción no disponible; se muestra el original.',
            'Traduzione non disponibile; viene mostrato l’originale.',
          )}
        </p>
      )}
      <div
        className="reader-body saved-poem-text poem-reading-text"
        data-width={preferences.width}
        style={{ fontSize: `${preferences.textSize}rem` }}
        lang={actualLanguage}
      >
        {text.content}
      </div>
    </article>
  );
}
