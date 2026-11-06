'use client';
import type { Book } from '@/lib/book-types';
import type { BookPageText } from '@/lib/book-text';
import type { PoemLanguage } from '@/lib/poem-types';
import BookReader from './book-reader';
import BookCovers, { type CoverBook } from './book-covers';

export default function BookPresentation({ book, language, coverSrc, cover2Src, fileId = book.file_id, preview = false, previewText }: { book: CoverBook & Pick<Book, 'description' | 'file_id'>; language: PoemLanguage; coverSrc?: string; cover2Src?: string; fileId?: string; preview?: boolean; previewText?: BookPageText }) {
  const ro = language === 'ro';
  return <><article className="book-detail"><BookCovers book={book} language={language} previewSources={[coverSrc, cover2Src]} /><div><p className="eyebrow">{ro ? 'Biblioteca Poetio' : 'Poetio library'}</p><h1>{book.title || (ro ? 'Fără titlu' : 'Untitled')}</h1>{book.author && <p className="reader-author">{book.author}</p>}<p className="book-description">{book.description}</p></div></article>
    {fileId ? <BookReader fileId={fileId} title={book.title} language={language} preview={preview} previewText={previewText} /> : <p role="status">{ro ? 'Pregătește PDF-ul privat în editor pentru a verifica paginile și textul în cititor.' : 'Prepare the private PDF in the editor to check pages and text in the reader.'}</p>}
  </>;
}
