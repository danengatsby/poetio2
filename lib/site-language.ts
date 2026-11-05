import type { PoemLanguage } from './poem-types';

export const SITE_LANGUAGE_COOKIE = 'poetio-language';
export const SITE_LANGUAGE_HEADER = 'x-poetio-language';

export function siteLanguage(value?: string | null, preference?: string | null): PoemLanguage {
  if (value === 'ro' || value === 'en-US') return value;
  return preference === 'en-US' ? 'en-US' : 'ro';
}

export function withSiteLanguage(href: string, language: PoemLanguage) {
  const url = new URL(href, 'https://poetio.invalid');
  url.searchParams.set('lang', language);
  return url.pathname + url.search + url.hash;
}

export function rememberSiteLanguage(language: PoemLanguage) {
  document.documentElement.lang = language;
  try {
    document.cookie = `${SITE_LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch { /* The selector remains usable when preference cookies are blocked. */ }
  // Keep an explicit URL in step with in-place selectors, without discarding
  // the reader position or an unsent comment. Preserve filters and fragments.
  try {
    history.replaceState(history.state, '', withSiteLanguage(location.href, language));
  } catch { /* In-memory selection still works when history cannot be changed. */ }
}

export const siteCopy = {
  ro: {
    skip: 'Mergi la poeme', home: 'Poetio — Acasă', note: 'O colecție independentă de poezie',
    navigation: 'Navigare principală', administration: 'Administrare', poems: 'Poeme', author: 'Autor',
    tagline: 'Cuvinte pentru clipele dintre', edition: 'O mică colecție · Nr. 01',
    takeTime: 'Fără grabă',
    collection: 'Colecția', slowly: 'Unele lucruri se citesc pe îndelete.', poetry: 'Poezie',
    empty: 'Următorul poem încă așteaptă să fie scris.', addFirst: 'Adaugă primul poem',
    closing: 'Lasă puțin loc', closingFor: 'pentru', unwritten: 'nescris.',
    footer: 'Un răgaz pentru tine.', back: 'Înapoi sus', close: 'Închide poemul',
    previous: '← Anteriorul', next: 'Următorul →', poemLanguage: 'Limba poemului',
    originalRomanian: 'Original în română', originalEnglish: 'Original în engleză',
    missing: 'Versiunea în română nu a fost încă adăugată.',
    readOriginal: 'Citește originalul în English (US)', addTranslation: 'Adaugă traducerea în Administrare',
    unavailableTitle: 'Poemele vor reveni.', unavailable: 'Colecția nu a putut fi încărcată. Încearcă din nou peste câteva clipe.', retry: 'Încearcă din nou',
    count: (n: number) => `${n} ${n === 1 ? 'poem' : 'poeme'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'vers' : 'versuri'}`,
    readBy: (title: string, author: string) => `Citește „${title}”, de ${author}`,
  },
  'en-US': {
    skip: 'Skip to poems', home: 'Poetio home', note: 'An independent poetry collection',
    navigation: 'Main navigation', administration: 'Administration', poems: 'The poems', author: 'Author',
    tagline: 'Words for the in-between', edition: 'A small collection · No. 01',
    takeTime: 'Take your time',
    collection: 'The collection', slowly: 'Some things are better read slowly.', poetry: 'Poetry',
    empty: 'The next poem is still unwritten.', addFirst: 'Add the first poem',
    closing: 'Leave a little room', closingFor: 'for the', unwritten: 'unwritten.',
    footer: 'A little room to breathe.', back: 'Back to top', close: 'Close poem',
    previous: '← Previous', next: 'Next poem →', poemLanguage: 'Poem language',
    originalRomanian: 'Romanian original', originalEnglish: 'English original',
    missing: 'The American English version has not been added yet.',
    readOriginal: 'Read the Romanian original', addTranslation: 'Add the translation in Administration',
    unavailableTitle: 'The poems will be back.', unavailable: 'The collection could not be loaded. Please try again in a moment.', retry: 'Try again',
    count: (n: number) => `${n} ${n === 1 ? 'poem' : 'poems'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`,
    readBy: (title: string, author: string) => `Read ${title} by ${author}`,
  },
};
