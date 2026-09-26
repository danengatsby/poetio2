'use client';
export default function BookReader({ src, title, language = 'ro' }: { src: string; title: string; language?: 'ro' | 'en-US' }) {
  const ro = language === 'ro';
  return <section className="book-reader" aria-label={ro ? 'Citire carte' : 'Book reader'}>
    <div className="book-reader-actions"><a className="primary-button" href={src} target="_blank" rel="noopener noreferrer">{ro ? 'Deschide PDF' : 'Open PDF'} ↗</a><a className="secondary-button" href={src.startsWith('blob:') ? src : `${src}?download=1`} download>{ro ? 'Descarcă PDF' : 'Download PDF'}</a></div>
    <p className="book-reader-note">{ro ? 'Dacă documentul nu se afișează mai jos, folosește „Deschide PDF” sau descarcă-l pentru a-l citi.' : 'If the document does not appear below, open the PDF or download it to read.'}</p>
    <iframe src={src} title={title} className="book-document" />
  </section>;
}
