'use client';
import SiteLogo from '../site-logo';
/* eslint-disable @next/next/no-html-link-for-pages -- Use document navigation with the shared header. */
import { useState } from 'react';
import { responsiveImage, cardImageSizes } from '@/lib/responsive-images';
/* eslint-disable @next/next/no-img-element -- Responsive private derivatives bypass an unrestricted image proxy. */
import type { Book, BookWithCommentCount } from '@/lib/book-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { rememberSiteLanguage, siteCopy } from '@/lib/site-language';
import SiteHeader from '../site-header';
import BookReader from './book-reader';
import { ReaderComments } from '../poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import './books.css';

export default function BooksView({ books = [], book, initialLanguage, canAdmin = false, failed = false }: { books?: BookWithCommentCount[]; book?: Book; initialLanguage: PoemLanguage; canAdmin?: boolean; failed?: boolean }) {
  const [language, setLanguage] = useState(initialLanguage);
  const ro = language === 'ro', copy = siteCopy[language];
  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
  }
  const cover = (item: Book) => item.image_id ? <img className="book-cover" {...responsiveImage(`/api/images/${item.image_id}`)} sizes={book ? "(max-width: 760px) 220px, 260px" : cardImageSizes} alt={ro ? `Coperta: ${item.title}` : `Cover: ${item.title}`} width={300} height={400} loading="lazy" decoding="async" /> : <span className="book-cover book-cover-placeholder"><span>Poetio✳</span><span>{item.title}</span><small>{item.author}</small></span>;
  return <>
    <a className="skip-link" href="#main">{copy.skip}</a><SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
    <main id="main" className="books-main shell">
      {book ? <>
        <a className="book-back" href="/carti">← {ro ? 'Toate cărțile' : 'All books'}</a>
        <article className="book-detail"><div>{cover(book)}</div><div><p className="eyebrow">{ro ? 'Biblioteca Poetio' : 'Poetio library'}</p><h1>{book.title}</h1>{book.author && <p className="reader-author">{book.author}</p>}<p className="book-description">{book.description}</p></div></article>
        <BookReader fileId={book.file_id} title={book.title} language={language} />
        <div className="book-comments"><ReaderComments key={book.id} endpoint={`/api/books/${book.id}/comments`} language={language} intro={ro ? 'Ce ți-a transmis această carte? Lasă câteva gânduri.' : 'What did this book bring to mind? Share a few thoughts.'} /></div>
      </> : <>
        <SiteLogo />
        <div className="section-heading"><div><p className="eyebrow">{ro ? 'Pagini de descoperit' : 'Pages to discover'}</p><h1>{ro ? 'Cărți' : 'Books'}<span className="count">({String(books.length).padStart(2, '0')})</span></h1></div><p>{ro ? 'Un răgaz pentru lectură.' : 'A moment to read.'}</p></div>
        {failed ? <div className="collection-empty" role="alert"><p>{ro ? 'Cărțile nu pot fi încărcate momentan.' : 'Books could not be loaded right now.'}</p><a className="secondary-button" href="/carti">{copy.retry}</a></div> : books.length ? <div className="poem-grid book-grid">{books.map((item, index) => <a className="poem-card book-card" href={`/carti/${item.id}`} key={item.id} aria-label={`${ro ? 'Citește' : 'Read'}: ${item.title} · ${commentCountLabel(item.comment_count, language)}`}>
          {cover(item)}<span className="card-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>PDF</span></span><h2>{item.title}</h2><p>{item.description || (ro ? 'Deschide pentru a citi.' : 'Open to read.')}</p><span className="card-bottom"><span>{item.author || 'Poetio'}<span className="card-comment-count">{commentCountLabel(item.comment_count, language)}</span></span><span aria-hidden="true">↗</span></span>
        </a>)}</div> : <div className="collection-empty"><p>{ro ? 'Prima carte va apărea aici în curând.' : 'The first book will appear here soon.'}</p>{canAdmin && <a className="primary-button" href="/admin/carti">{ro ? 'Adaugă prima carte' : 'Add the first book'}</a>}</div>}
      </>}
    </main><footer className="site-footer shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><p>{copy.footer}</p><a href="#" className="back-top">{copy.back} ↑</a></footer>
  </>;
}
