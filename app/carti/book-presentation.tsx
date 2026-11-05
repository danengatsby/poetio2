'use client';
/* eslint-disable @next/next/no-img-element -- Public derivatives and local preview covers share the same display. */
import { responsiveImage } from '@/lib/responsive-images';
import type { Book } from '@/lib/book-types';
import type { BookPageText } from '@/lib/book-text';
import type { PoemLanguage } from '@/lib/poem-types';
import BookReader from './book-reader';

export default function BookPresentation({ book, language, coverSrc, fileId = book.file_id, preview = false, previewText }: { book: Pick<Book, 'title' | 'author' | 'description' | 'image_id' | 'file_id'>; language: PoemLanguage; coverSrc?: string; fileId?: string; preview?: boolean; previewText?: BookPageText }) {
  const ro = language === 'ro';
  return <><article className="book-detail"><div>{coverSrc || book.image_id ? <img className="book-cover" {...(coverSrc ? { src: coverSrc } : responsiveImage(`/api/images/${book.image_id}`))} sizes="(max-width:760px) 220px,260px" width={300} height={400} alt={ro ? `Coperta: ${book.title}` : `Cover: ${book.title}`} /> : <span className="book-cover book-cover-placeholder"><span>Poetio✳</span><span>{book.title}</span><small>{book.author}</small></span>}</div><div><p className="eyebrow">{ro ? 'Biblioteca Poetio' : 'Poetio library'}</p><h1>{book.title || (ro ? 'Fără titlu' : 'Untitled')}</h1>{book.author && <p className="reader-author">{book.author}</p>}<p className="book-description">{book.description}</p></div></article>
    {fileId ? <BookReader fileId={fileId} title={book.title} language={language} preview={preview} previewText={previewText} /> : <p role="status">{ro ? 'Pregătește PDF-ul privat în editor pentru a verifica paginile și textul în cititor.' : 'Prepare the private PDF in the editor to check pages and text in the reader.'}</p>}
  </>;
}
