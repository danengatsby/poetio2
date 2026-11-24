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
  const { preferences, storageAvailable, setPreferences, resetPreferences } = usePoemReadingPreferences();
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
      <details className="poem-reading-settings">
        <summary>
          {pick(
            language,
            'Confort de lectură',
            'Reading comfort',
            'Confort de lecture',
            'Lesekomfort',
            'Comodidad de lectura',
            'Comfort di lettura',
          )}
        </summary>
        <div className="poem-reading-controls">
          <div
            role="group"
            aria-label={pick(
              language,
              'Dimensiunea versurilor',
              'Poem text size',
              'Taille du texte du poème',
              'Textgröße des Gedichts',
              'Tamaño del texto del poema',
              'Dimensione del testo della poesia',
            )}
          >
            <button
              type="button"
              className="secondary-button"
              disabled={preferences.textSize <= 1}
              onClick={() => setPreferences({ textSize: Math.max(1, preferences.textSize - 0.125) })}
              aria-label={pick(
                language,
                'Micșorează versurile',
                'Decrease poem text size',
                'Réduire le texte du poème',
                'Gedichttext verkleinern',
                'Reducir el texto del poema',
                'Riduci il testo della poesia',
              )}
            >
              A−
            </button>
            <output aria-live="polite">{Math.round(preferences.textSize * 100)}%</output>
            <button
              type="button"
              className="secondary-button"
              disabled={preferences.textSize >= 2}
              onClick={() => setPreferences({ textSize: Math.min(2, preferences.textSize + 0.125) })}
              aria-label={pick(
                language,
                'Mărește versurile',
                'Increase poem text size',
                'Agrandir le texte du poème',
                'Gedichttext vergrößern',
                'Ampliar el texto del poema',
                'Ingrandisci il testo della poesia',
              )}
            >
              A+
            </button>
          </div>
          <label>
            {pick(
              language,
              'Lățimea textului',
              'Text width',
              'Largeur du texte',
              'Textbreite',
              'Ancho del texto',
              'Larghezza del testo',
            )}
            <select
              value={preferences.width}
              onChange={event => setPreferences({ width: event.target.value as typeof preferences.width })}
            >
              <option value="narrow">
                {pick(language, 'Îngustă', 'Narrow', 'Étroite', 'Schmal', 'Estrecho', 'Stretta')}
              </option>
              <option value="normal">{pick(language, 'Medie', 'Medium', 'Moyenne', 'Mittel', 'Medio', 'Media')}</option>
              <option value="wide">{pick(language, 'Largă', 'Wide', 'Large', 'Breit', 'Ancho', 'Larga')}</option>
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={resetPreferences}>
            {pick(
              language,
              'Resetează lectura',
              'Reset reading settings',
              'Réinitialiser les réglages de lecture',
              'Leseeinstellungen zurücksetzen',
              'Restablecer los ajustes de lectura',
              'Ripristina le impostazioni di lettura',
            )}
          </button>
        </div>
        <p className="field-help" role="status">
          {storageAvailable
            ? pick(
                language,
                'Preferințele poemelor se păstrează în acest browser.',
                'Poem preferences are saved in this browser.',
                'Les préférences de lecture sont enregistrées dans ce navigateur.',
                'Die Leseeinstellungen werden in diesem Browser gespeichert.',
                'Las preferencias de lectura se guardan en este navegador.',
                'Le preferenze di lettura vengono salvate in questo browser.',
              )
            : pick(
                language,
                'Preferințele nu pot fi salvate. Reglajele funcționează până la reîncărcare.',
                'Preferences cannot be saved. Controls still work until you reload.',
                'Les préférences ne peuvent pas être enregistrées. Les réglages fonctionnent jusqu’au prochain rechargement.',
                'Die Einstellungen können nicht gespeichert werden. Sie funktionieren bis zum nächsten Neuladen.',
                'No se pueden guardar las preferencias. Los ajustes funcionan hasta que recargues la página.',
                'Non è possibile salvare le preferenze. Le impostazioni funzionano fino al prossimo ricaricamento.',
              )}
        </p>
      </details>
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
