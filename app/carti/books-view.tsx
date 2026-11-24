'use client';
import SiteLogo from '../site-logo';
// Use document navigation with the shared header.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Book, BookWithCommentCount } from '@/lib/book-types';
import type { SiteLanguage } from '@/lib/poem-types';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from '../site-header';
import BookPresentation from './book-presentation';
import BookCovers from './book-covers';
import { bookSalePath, type SaleVariant } from '@/lib/book-sale';
import { formatBookPrice } from '@/lib/book-price';
import { ReaderComments } from '../poem-comments';
import { commentCountLabel } from '@/lib/poem-comments';
import './books.css';
import LegalLinks from '../legal-links';

export type LibraryBook = BookWithCommentCount & { offer?: SaleVariant };

export default function BooksView({
  books = [],
  book,
  initialLanguage,
  canAdmin = false,
  failed = false,
}: {
  books?: LibraryBook[];
  book?: Book;
  initialLanguage: SiteLanguage;
  canAdmin?: boolean;
  failed?: boolean;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const router = useRouter();
  const copy = siteCopy[language];
  function changeLanguage(value: SiteLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  return (
    <>
      <a className="skip-link" href="#main">
        {copy.skip}
      </a>
      <SiteHeader language={language} onLanguageChange={changeLanguage} booksPage />
      <main id="main" className="books-main shell" lang={language}>
        {book ? (
          <>
            <a className="book-back" href={withSiteLanguage('/carti', language)}>
              ←{' '}
              {pick(
                language,
                'Toate cărțile',
                'All books',
                'Tous les livres',
                'Alle Bücher',
                'Todos los libros',
                'Tutti i libri',
              )}
            </a>
            <BookPresentation book={book} language={language} />
            <div className="book-comments">
              <ReaderComments
                key={book.id}
                endpoint={`/api/books/${book.id}/comments`}
                language={language}
                intro={pick(
                  language,
                  'Ce ți-a transmis această carte? Lasă câteva gânduri.',
                  'What did this book bring to mind? Share a few thoughts.',
                  'Qu’est-ce que ce livre vous a évoqué\u00a0? Partagez quelques pensées.',
                  'Woran hat Sie dieses Buch erinnert? Teilen Sie ein paar Gedanken.',
                  '¿Qué te ha evocado este libro? Comparte algunas ideas.',
                  'Che cosa ti ha suscitato questo libro? Condividi qualche pensiero.',
                )}
              />
            </div>
          </>
        ) : (
          <>
            <SiteLogo />
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {pick(
                    language,
                    'Pagini de descoperit',
                    'Pages to discover',
                    'Des pages à découvrir',
                    'Seiten zum Entdecken',
                    'Páginas por descubrir',
                    'Pagine da scoprire',
                  )}
                </p>
                <h1>
                  {pick(language, 'Cărți', 'Books', 'Livres', 'Bücher', 'Libros', 'Libri')}
                  <span className="count">({String(books.length).padStart(2, '0')})</span>
                </h1>
              </div>
              <p>
                {pick(
                  language,
                  'Un răgaz pentru lectură.',
                  'A moment to read.',
                  'Un moment pour lire.',
                  'Ein Moment zum Lesen.',
                  'Un momento para leer.',
                  'Un momento per leggere.',
                )}
              </p>
            </div>
            {failed ? (
              <div className="collection-empty" role="alert">
                <p>
                  {pick(
                    language,
                    'Cărțile nu pot fi încărcate momentan.',
                    'Books could not be loaded right now.',
                    'Les livres n’ont pas pu être chargés pour le moment.',
                    'Die Bücher konnten gerade nicht geladen werden.',
                    'Ahora mismo no se pudieron cargar los libros.',
                    'Al momento non è stato possibile caricare i libri.',
                  )}
                </p>
                <a className="secondary-button" href={withSiteLanguage('/carti', language)}>
                  {copy.retry}
                </a>
              </div>
            ) : books.length ? (
              <div className="poem-grid book-grid">
                {books.map(item => (
                  <article className="poem-card book-card" key={item.id}>
                    <h2>
                      <a className="book-title-link" href={withSiteLanguage(`/carti/${item.id}`, language)}>
                        {item.title}
                      </a>
                    </h2>
                    <div className="library-actions">
                      <a className="book-read-link" href={withSiteLanguage(`/carti/${item.id}#lectura`, language)}>
                        {pick(
                          language,
                          'Citește online',
                          'Read online',
                          'Lire en ligne',
                          'Online lesen',
                          'Leer en línea',
                          'Leggi online',
                        )}
                      </a>
                      {item.offer && (
                        <a
                          className="book-read-link"
                          href={withSiteLanguage(bookSalePath(item.id, item.offer.cover), language)}
                        >
                          {pick(
                            language,
                            'Cumpără cartea tipărită',
                            'Buy the printed book',
                            'Acheter le livre imprimé',
                            'Gedrucktes Buch kaufen',
                            'Comprar el libro impreso',
                            'Acquista il libro stampato',
                          )}
                          {' · '}
                          {formatBookPrice(item.offer.price, language)}
                        </a>
                      )}
                    </div>
                    <BookCovers book={item} language={language} compact />
                    {item.description && <p>{item.description}</p>}
                    <div className="card-bottom">
                      <span>
                        {item.author || 'Poetio'}
                        <span className="card-comment-count">{commentCountLabel(item.comment_count, language)}</span>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="collection-empty">
                <p>
                  {pick(
                    language,
                    'Prima carte va apărea aici în curând.',
                    'The first book will appear here soon.',
                    'Le premier livre apparaîtra bientôt ici.',
                    'Das erste Buch erscheint bald hier.',
                    'El primer libro aparecerá pronto aquí.',
                    'Il primo libro apparirà presto qui.',
                  )}
                </p>
                {canAdmin && (
                  <a className="primary-button" href="/admin/carti">
                    {pick(
                      language,
                      'Adaugă prima carte',
                      'Add the first book',
                      'Ajouter le premier livre',
                      'Das erste Buch hinzufügen',
                      'Añadir el primer libro',
                      'Aggiungi il primo libro',
                    )}
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="site-footer shell">
        <a href={withSiteLanguage('/', language)} className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <p>
          {copy.footer} · <LegalLinks language={language} />
        </p>
        <a href="#" className="back-top">
          {copy.back} ↑
        </a>
      </footer>
    </>
  );
}
