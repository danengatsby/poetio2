'use client';
import type { SiteLanguage } from '@/lib/poem-types';
import { useEffect, useRef, useState } from 'react';
import { fetchBookText, fetchBookSearch, textMatch, type BookPageText, type BookSearchResult } from '@/lib/book-text';
import { bookTextSize } from '@/lib/book-reading';
import { pick } from '@/lib/site-language';

type Props = {
  previewText?: BookPageText;
  fileId: string;
  page: number;
  pages: number;
  language: SiteLanguage;
  size: number;
  onSizeChange: (size: number) => void;
  onGo: (page: number) => void;
  onRead: (page: number) => void;
};
export default function BookTextView({ previewText, fileId, page, language, size, onSizeChange, onGo, onRead }: Props) {
  const [query, setQuery] = useState(''),
    [searched, setSearched] = useState('');
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [busy, setBusy] = useState(false),
    [searchFailed, setSearchFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const focusPage = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(term: string, offset = 0, retry = false) {
    term = term.trim().normalize('NFC');
    if (term.length < 2) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setSearched(term);
    setResult(null);
    setBusy(true);
    setSearchFailed(false);
    try {
      // An unsaved editor preview searches only its own page and stays private.
      if (previewText) {
        const match = textMatch(previewText.text, term);
        setResult({
          status: 'ready',
          pages: 1,
          scanned: 1,
          unavailable: 0,
          total: match ? 1 : 0,
          offset: 0,
          hasMore: false,
          results: match
            ? [
                {
                  page: previewText.page,
                  excerpt: previewText.text.slice(Math.max(0, match.start - 60), match.end + 100),
                },
              ]
            : [],
        });
        return;
      }
      do {
        const value = await fetchBookSearch(fileId, term, offset, abort.signal, retry);
        retry = false;
        if (abort.signal.aborted) return;
        setResult(value);
        if (value.status !== 'preparing') break;
        await new Promise<void>(resolve => {
          const timer = setTimeout(done, 1500);
          function done() {
            clearTimeout(timer);
            abort.signal.removeEventListener('abort', done);
            resolve();
          }
          abort.signal.addEventListener('abort', done, { once: true });
          if (abort.signal.aborted) done();
        });
      } while (!abort.signal.aborted);
    } catch {
      if (!abort.signal.aborted) setSearchFailed(true);
    } finally {
      if (controller.current === abort) setBusy(false);
    }
  }
  return (
    <div className="book-text-view">
      <div
        className="book-text-tools"
        role="group"
        aria-label={pick(language, 'Dimensiunea textului', 'Text size', 'Taille du texte')}
      >
        <button
          className="secondary-button"
          type="button"
          onClick={() => onSizeChange(Math.max(bookTextSize.min, size - bookTextSize.step))}
          disabled={size <= bookTextSize.min}
          aria-label={pick(language, 'Micșorează textul', 'Decrease text size', 'Réduire le texte')}
        >
          A−
        </button>
        <span>{Math.round(size * 100)}%</span>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onSizeChange(Math.min(bookTextSize.max, size + bookTextSize.step))}
          disabled={size >= bookTextSize.max}
          aria-label={pick(language, 'Mărește textul', 'Increase text size', 'Agrandir le texte')}
        >
          A+
        </button>
      </div>
      <form
        className="book-text-search"
        onSubmit={event => {
          event.preventDefault();
          void search(query);
        }}
        role="search"
        aria-label={pick(language, 'Caută în carte', 'Search this book', 'Rechercher dans ce livre')}
      >
        <label>
          {previewText
            ? pick(
                language,
                'Caută în pagina previzualizată',
                'Search the previewed page',
                'Rechercher dans la page affichée',
              )
            : pick(language, 'Caută în textul cărții', 'Search the book text', 'Rechercher dans le texte du livre')}
          <input
            type="search"
            minLength={2}
            maxLength={120}
            required
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={busy} type="submit">
          {pick(language, 'Caută', 'Search', 'Rechercher')}
        </button>
        {busy && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
          >
            {pick(language, 'Oprește căutarea', 'Stop searching', 'Arrêter la recherche')}
          </button>
        )}
      </form>
      {searchFailed && (
        <div role="alert">
          <p>
            {pick(
              language,
              'Căutarea nu poate fi încărcată momentan. Textul paginii rămâne disponibil.',
              'Search could not be loaded. You can still read the current page.',
              'La recherche n’a pas pu être chargée. Vous pouvez toujours lire la page actuelle.',
            )}
          </p>
          <button type="button" className="secondary-button" onClick={() => void search(searched)}>
            {pick(language, 'Reîncearcă', 'Try again', 'Réessayer')}
          </button>
        </div>
      )}
      {searched && result && (
        <div className="book-text-results">
          <p role="status">
            {result.status === 'preparing'
              ? pick(
                  language,
                  `Se pregătește căutarea: ${result.scanned} din ${result.pages} pagini. ${result.total} pagini găsite până acum.`,
                  `Preparing search: ${result.scanned} of ${result.pages} pages. ${result.total} matching pages so far.`,
                  `Préparation de la recherche\u00a0: ${result.scanned} pages sur ${result.pages}. ${result.total} pages correspondantes pour l’instant.`,
                )
              : result.status === 'error'
                ? pick(
                    language,
                    'Pregătirea căutării s-a întrerupt. Rezultatele sunt incomplete.',
                    'Search preparation stopped. Results are incomplete.',
                    'Préparation de la recherche interrompue. Les résultats sont incomplets.',
                  )
                : pick(
                    language,
                    `${result.total} pagini găsite.`,
                    `${result.total} matching pages.`,
                    `${result.total} pages correspondantes.`,
                  )}
          </p>
          {result.unavailable > 0 && (
            <p>
              {pick(
                language,
                `Text indisponibil pentru ${result.unavailable} pagini; rezultatele sunt incomplete.`,
                `Text unavailable for ${result.unavailable} pages; results are incomplete.`,
                `Texte indisponible pour ${result.unavailable} pages\u00a0; les résultats sont incomplets.`,
              )}
            </p>
          )}
          {!busy && (result.unavailable > 0 || result.status === 'error') && (
            <button type="button" className="secondary-button" onClick={() => void search(searched, 0, true)}>
              {pick(
                language,
                'Reîncearcă paginile indisponibile',
                'Retry unavailable pages',
                'Réessayer les pages indisponibles',
              )}
            </button>
          )}
          <ol>
            {result.results.map(item => (
              <li key={item.page}>
                <button
                  type="button"
                  className="book-text-result"
                  onClick={() => {
                    focusPage.current = true;
                    onGo(item.page);
                    if (item.page === page) document.getElementById('book-text-heading')?.focus();
                  }}
                >
                  <strong>
                    {pick(language, 'Pagina', 'Page', 'Page')} {item.page}
                  </strong>{' '}
                  — {item.excerpt}
                </button>
              </li>
            ))}
          </ol>
          {(result.offset > 0 || result.hasMore) && (
            <nav aria-label={pick(language, 'Paginile rezultatelor', 'Search result pages', 'Pages de résultats')}>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || result.offset === 0}
                onClick={() => void search(searched, Math.max(0, result.offset - 20))}
              >
                {pick(language, 'Anterioarele', 'Previous results', 'Résultats précédents')}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || !result.hasMore}
                onClick={() => void search(searched, result.offset + 20)}
              >
                {pick(language, 'Următoarele', 'Next results', 'Résultats suivants')}
              </button>
            </nav>
          )}
        </div>
      )}
      {previewText?.page === page ? (
        <TextPageContent data={previewText} language={language} size={size} query={searched} />
      ) : (
        <TextPage
          key={`${fileId}:${page}`}
          fileId={fileId}
          page={page}
          language={language}
          size={size}
          query={searched}
          onRead={onRead}
          onReady={() => {
            if (focusPage.current) {
              document.getElementById('book-text-heading')?.focus();
              focusPage.current = false;
            }
          }}
        />
      )}
    </div>
  );
}

function TextPage({
  fileId,
  page,
  language,
  size,
  query,
  onRead,
  onReady,
}: {
  fileId: string;
  page: number;
  language: SiteLanguage;
  size: number;
  query: string;
  onRead: (page: number) => void;
  onReady: () => void;
}) {
  const [data, setData] = useState<BookPageText | null>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });
  useEffect(() => {
    const abort = new AbortController();
    fetchBookText(fileId, page, abort.signal)
      .then(value => {
        if (abort.signal.aborted) return;
        setData(value);
        if (value.text.trim()) onRead(page);
        requestAnimationFrame(() => {
          if (!abort.signal.aborted) ready.current();
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, [fileId, page, retry, onRead]);
  if (failed)
    return (
      <div role="alert">
        <p>
          {pick(
            language,
            'Textul nu poate fi încărcat momentan. Reîncearcă sau consultă pagina originală.',
            'Text could not be loaded. Try again or use the original page.',
            'Le texte n’a pas pu être chargé. Réessayez ou utilisez la page originale.',
          )}
        </p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setFailed(false);
            setRetry(value => value + 1);
          }}
        >
          {pick(language, 'Reîncearcă textul', 'Retry text', 'Recharger le texte')}
        </button>
      </div>
    );
  if (!data)
    return (
      <p role="status">
        {pick(
          language,
          'Se pregătește textul paginii… Pentru scanări poate dura mai mult.',
          'Preparing page text… Scanned pages may take longer.',
          'Préparation du texte de la page… Les pages numérisées peuvent prendre plus de temps.',
        )}
      </p>
    );
  return <TextPageContent data={data} language={language} size={size} query={query} />;
}
function TextPageContent({
  data,
  language,
  size,
  query,
}: {
  data: BookPageText;
  language: SiteLanguage;
  size: number;
  query: string;
}) {
  const page = data.page;
  const match = textMatch(data.text, query);
  return (
    <article className="book-text-page" aria-labelledby="book-text-heading">
      <h3 id="book-text-heading" tabIndex={-1}>
        {pick(language, 'Pagina', 'Page', 'Page')} {page}
      </h3>
      <p className="book-reader-note">
        {data.reviewed
          ? pick(
              language,
              'Text verificat de administrator.',
              'Text reviewed by the administrator.',
              'Texte vérifié par l’administrateur.',
            )
          : data.source === 'edited'
            ? pick(language, 'Transcriere neverificată.', 'Unreviewed transcription.', 'Transcription non vérifiée.')
            : data.source === 'ocr'
              ? pick(
                  language,
                  'Text recunoscut automat din imagine, neverificat. Pot exista greșeli sau omisiuni.',
                  'Unreviewed text recognized from the image. Errors or omissions may remain.',
                  'Texte non vérifié, reconnu à partir de l’image. Il peut contenir des erreurs ou des omissions.',
                )
              : pick(
                  language,
                  'Text extras automat, neverificat. Ordinea de lectură poate necesita corectare.',
                  'Unreviewed extracted text. Reading order may need correction.',
                  'Texte extrait non vérifié. L’ordre de lecture peut nécessiter une correction.',
                )}
      </p>
      {data.text ? (
        <div className="book-readable-text" lang={data.language} dir="auto" style={{ fontSize: `${size}rem` }}>
          {!match ? (
            data.text
          ) : (
            <>
              {data.text.slice(0, match.start)}
              <mark>{data.text.slice(match.start, match.end)}</mark>
              {data.text.slice(match.end)}
            </>
          )}
        </div>
      ) : (
        <p>
          {pick(
            language,
            'Nu s-a putut recunoaște text pe această pagină. Consultă originalul; pagina poate necesita transcriere sau descriere manuală.',
            'No text could be recognized on this page. Use the original; a manual transcription or description may be needed.',
            'Aucun texte n’a pu être reconnu sur cette page. Utilisez l’original\u00a0; une transcription ou une description manuelle peut être nécessaire.',
          )}
        </p>
      )}
    </article>
  );
}
