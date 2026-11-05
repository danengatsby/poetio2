'use client';
import type { Poem, PoemLanguage } from '@/lib/poem-types';
import { poemVersion } from '@/lib/poem-languages';
import PoemAudioPlayer from './poem-audio-player';
import usePoemReadingPreferences from './use-poem-reading-preferences';
import './poem-reading.css';

export type ReadablePoem = Pick<Poem, 'title' | 'author' | 'theme' | 'content' | 'source_language' | 'translated_title' | 'translated_theme' | 'translated_content' | 'audio_ro_id' | 'audio_en_id'>;
export default function PoemReading({ poem, language, audioSrc, mediaStatus = false, children }: { poem: ReadablePoem; language: PoemLanguage; audioSrc?: string; mediaStatus?: boolean; children?: React.ReactNode }) {
  const version = poemVersion(poem, language), text = version ?? poem;
  const actualLanguage = version ? language : poem.source_language, ro = language === 'ro';
  const { preferences, storageAvailable, setPreferences, resetPreferences } = usePoemReadingPreferences();
  return <article className="poem-reading" lang={language}>
    <p className="eyebrow" lang={actualLanguage}>{text.theme || (ro ? 'Poezie' : 'Poetry')}</p>
    <h1 lang={actualLanguage}>{text.title || (ro ? 'Fără titlu' : 'Untitled')}</h1>
    {poem.author && <p className="reader-author">{poem.author}</p>}
    {children}
    <details className="poem-reading-settings"><summary>{ro ? 'Confort de lectură' : 'Reading comfort'}</summary>
      <div className="poem-reading-controls">
        <div role="group" aria-label={ro ? 'Dimensiunea versurilor' : 'Poem text size'}>
          <button type="button" className="secondary-button" disabled={preferences.textSize <= 1} onClick={() => setPreferences({ textSize: Math.max(1, preferences.textSize - .125) })} aria-label={ro ? 'Micșorează versurile' : 'Decrease poem text size'}>A−</button>
          <output aria-live="polite">{Math.round(preferences.textSize * 100)}%</output>
          <button type="button" className="secondary-button" disabled={preferences.textSize >= 2} onClick={() => setPreferences({ textSize: Math.min(2, preferences.textSize + .125) })} aria-label={ro ? 'Mărește versurile' : 'Increase poem text size'}>A+</button>
        </div>
        <label>{ro ? 'Lățimea textului' : 'Text width'}<select value={preferences.width} onChange={event => setPreferences({ width: event.target.value as typeof preferences.width })}>
          <option value="narrow">{ro ? 'Îngustă' : 'Narrow'}</option><option value="normal">{ro ? 'Medie' : 'Medium'}</option><option value="wide">{ro ? 'Largă' : 'Wide'}</option>
        </select></label>
        <button type="button" className="secondary-button" onClick={resetPreferences}>{ro ? 'Resetează lectura' : 'Reset reading settings'}</button>
      </div>
      <p className="field-help" role="status">{storageAvailable ? (ro ? 'Preferințele poemelor se păstrează în acest browser.' : 'Poem preferences are saved in this browser.') : (ro ? 'Preferințele nu pot fi salvate. Reglajele funcționează până la reîncărcare.' : 'Preferences cannot be saved. Controls still work until you reload.')}</p>
    </details>
    <PoemAudioPlayer key={audioSrc || poem[actualLanguage === 'en-US' ? 'audio_en_id' : 'audio_ro_id']} audioId={poem[actualLanguage === 'en-US' ? 'audio_en_id' : 'audio_ro_id']} src={audioSrc} title={text.title} language={actualLanguage} showStatus={mediaStatus} />
    {!version && <p className="original-language-note">{ro ? 'Traducerea nu este disponibilă; se afișează originalul.' : 'Translation unavailable; showing the original.'}</p>}
    <div className="reader-body saved-poem-text poem-reading-text" data-width={preferences.width} style={{ fontSize: `${preferences.textSize}rem` }} lang={actualLanguage}>{text.content}</div>
  </article>;
}
