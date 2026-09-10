import type { PoemLanguage } from './poem-types';

export const SITE_LANGUAGE_COOKIE = 'poetio-language';

export function siteLanguage(value?: string): PoemLanguage {
  return value === 'en-US' ? 'en-US' : 'ro';
}

export const siteCopy = {
  ro: {
    skip: 'Mergi la poeme', home: 'Poetio — Acasă', note: 'O colecție independentă de poezie',
    navigation: 'Navigare principală', administration: 'Administrare', poems: 'Poemele',
    tagline: 'Cuvinte pentru clipele dintre', edition: 'O mică colecție · Nr. 01',
    intro: 'Un loc pentru', pause: 'răgaz.', featured: 'Poemul în prim-plan',
    read: 'Citește poemul', moment: 'O clipă doar pentru tine', takeTime: 'Fără grabă',
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
    navigation: 'Main navigation', administration: 'Administration', poems: 'The poems',
    tagline: 'Words for the in-between', edition: 'A small collection · No. 01',
    intro: 'A place to', pause: 'pause.', featured: 'The featured poem',
    read: 'Read the poem', moment: 'A moment to yourself', takeTime: 'Take your time',
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
