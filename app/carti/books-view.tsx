'use client';
import SiteLogo from '../site-logo';
// Use document navigation with the shared header.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Book, BookWithCommentCount } from '@/lib/book-types';
import type { PoemLanguage } from '@/lib/poem-types';
import { rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import BookPresentation from './book-presentation';
import BookCovers from './book-covers';
import { ReaderComments } from '../poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import './books.css';

export default function BooksView({ books = [], book, initialLanguage, canAdmin = false, failed = false }: { books?: BookWithCommentCount[]; book?: Book; initialLanguage: PoemLanguage; canAdmin?: boolean; failed?: boolean }) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const ro = language === 'ro', copy = siteCopy[language];
  function changeLanguage(value: PoemLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  return <>
    <a className="skip-link" href="#main">{copy.skip}</a><SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
    <main id="main" className="books-main shell" lang={language}>
      {book ? <>
        <a className="book-back" href={withSiteLanguage('/carti', language)}>← {ro ? 'Toate cărțile' : 'All books'}</a>
        <BookPresentation book={book} language={language} />
        <div className="book-comments"><ReaderComments key={book.id} endpoint={`/api/books/${book.id}/comments`} language={language} intro={ro ? 'Ce ți-a transmis această carte? Lasă câteva gânduri.' : 'What did this book bring to mind? Share a few thoughts.'} /></div>
      </> : <>
        <SiteLogo />
        <div className="section-heading"><div><p className="eyebrow">{ro ? 'Pagini de descoperit' : 'Pages to discover'}</p><h1>{ro ? 'Cărți' : 'Books'}<span className="count">({String(books.length).padStart(2, '0')})</span></h1></div><p>{ro ? 'Un răgaz pentru lectură.' : 'A moment to read.'}</p></div>
        {failed ? <div className="collection-empty" role="alert"><p>{ro ? 'Cărțile nu pot fi încărcate momentan.' : 'Books could not be loaded right now.'}</p><a className="secondary-button" href={withSiteLanguage('/carti', language)}>{copy.retry}</a></div> : books.length ? <div className="poem-grid book-grid">{books.map((item, index) => <article className="poem-card book-card" key={item.id}>
          <BookCovers book={item} language={language} compact /><span className="card-meta"><span>{String(index + 1).padStart(2, '0')}</span><span>PDF</span></span><h2><a className="book-title-link" href={withSiteLanguage(`/carti/${item.id}`, language)}>{item.title}</a></h2><p>{item.description || (ro ? 'Deschide pentru a citi.' : 'Open to read.')}</p><div className="card-bottom"><span>{item.author || 'Poetio'}<span className="card-comment-count">{commentCountLabel(item.comment_count, language)}</span></span><a className="book-read-link" href={withSiteLanguage(`/carti/${item.id}`, language)} aria-label={`${ro ? 'Citește' : 'Read'}: ${item.title}`}>{ro ? 'Citește' : 'Read'} ↗</a></div>
        </article>)}</div> : <div className="collection-empty"><p>{ro ? 'Prima carte va apărea aici în curând.' : 'The first book will appear here soon.'}</p>{canAdmin && <a className="primary-button" href="/admin/carti">{ro ? 'Adaugă prima carte' : 'Add the first book'}</a>}</div>}
      </>}
    </main><footer className="site-footer shell"><a href={withSiteLanguage('/', language)} className="wordmark">Poetio<span aria-hidden="true">✳</span></a><p>{copy.footer}</p><a href="#" className="back-top">{copy.back} ↑</a></footer>
  </>;
}
