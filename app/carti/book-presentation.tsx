'use client';
import type { Book } from '@/lib/book-types';
import type { BookPageText } from '@/lib/book-text';
import type { SiteLanguage } from '@/lib/poem-types';
import BookReader from './book-reader';
import BookCovers, { type CoverBook } from './book-covers';
import { pick } from '@/lib/site-language';

export default function BookPresentation({
  book,
  language,
  coverSrc,
  cover2Src,
  fileId = book.file_id,
  preview = false,
  savedBook = false,
  previewText,
}: {
  book: CoverBook & Pick<Book, 'description' | 'file_id'>;
  language: SiteLanguage;
  coverSrc?: string;
  cover2Src?: string;
  fileId?: string;
  preview?: boolean;
  /** In the editor's preview: the book exists, so its sale page can open in a new tab. */
  savedBook?: boolean;
  previewText?: BookPageText;
}) {
  return (
    <>
      <article className="book-detail">
        <BookCovers
          book={book}
          language={language}
          previewSources={[coverSrc, cover2Src]}
          saleLinks={!preview || savedBook}
          newTab={preview}
        />
        <div>
          <p className="eyebrow">
            {pick(language, 'Biblioteca Poetio', 'Poetio library', 'Bibliothèque Poetio', 'Poetio-Bibliothek')}
          </p>
          <h1>{book.title || pick(language, 'Fără titlu', 'Untitled', 'Sans titre', 'Ohne Titel')}</h1>
          {book.author && <p className="reader-author">{book.author}</p>}
          <p className="book-description">{book.description}</p>
        </div>
      </article>
      {fileId ? (
        <BookReader
          fileId={fileId}
          title={book.title}
          language={language}
          preview={preview}
          previewText={previewText}
        />
      ) : (
        <p role="status">
          {pick(
            language,
            'Pregătește PDF-ul privat în editor pentru a verifica paginile și textul în cititor.',
            'Prepare the private PDF in the editor to check pages and text in the reader.',
            'Préparez le PDF privé dans l’éditeur pour vérifier les pages et le texte dans la liseuse.',
            'Bereiten Sie das private PDF im Editor vor, um Seiten und Text im Leser zu prüfen.',
          )}
        </p>
      )}
    </>
  );
}
