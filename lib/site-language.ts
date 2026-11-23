import type { SiteLanguage } from './poem-types';

export const SITE_LANGUAGE_COOKIE = 'poetio-language';
export const SITE_LANGUAGE_HEADER = 'x-poetio-language';
export const SITE_LANGUAGES: SiteLanguage[] = ['ro', 'en-US', 'fr', 'de', 'es', 'it'];

const isSiteLanguage = (value: unknown): value is SiteLanguage =>
  value === 'ro' || value === 'en-US' || value === 'fr' || value === 'de' || value === 'es' || value === 'it';

export function siteLanguage(value?: string | null, preference?: string | null): SiteLanguage {
  if (isSiteLanguage(value)) return value;
  return isSiteLanguage(preference) ? preference : 'ro';
}

/** The Romanian, American English, French, German, Spanish or Italian text, for the site's language. */
export function pick<T>(language: SiteLanguage, ro: T, en: T, fr: T, de: T, es: T, it: T): T {
  return { ro, 'en-US': en, fr, de, es, it }[language];
}

/** Locale for dates and numbers. */
export const siteLocale = (language: SiteLanguage) => pick(language, 'ro', 'en-US', 'fr-FR', 'de-DE', 'es-ES', 'it-IT');
/** Open Graph locale. */
export const ogLocale = (language: SiteLanguage) =>
  pick(language, 'ro_RO', 'en_US', 'fr_FR', 'de_DE', 'es_ES', 'it_IT');

export function withSiteLanguage(href: string, language: SiteLanguage) {
  const url = new URL(href, 'https://poetio.invalid');
  url.searchParams.set('lang', language);
  return url.pathname + url.search + url.hash;
}

export function rememberSiteLanguage(language: SiteLanguage) {
  document.documentElement.lang = language;
  try {
    document.cookie = `${SITE_LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch {
    /* The selector remains usable when preference cookies are blocked. */
  }
  // Keep an explicit URL in step with in-place selectors, without discarding
  // the reader position or an unsent comment. Preserve filters and fragments.
  try {
    history.replaceState(history.state, '', withSiteLanguage(location.href, language));
  } catch {
    /* In-memory selection still works when history cannot be changed. */
  }
}

export const siteCopy = {
  ro: {
    skip: 'Mergi la poeme',
    home: 'Poetio — Acasă',
    note: 'O colecție independentă de poezie',
    navigation: 'Navigare principală',
    administration: 'Administrare',
    poems: 'Poeme',
    author: 'Autor',
    tagline: 'Cuvinte pentru clipele dintre',
    edition: 'O mică colecție · Nr. 01',
    takeTime: 'Fără grabă',
    collection: 'Colecția',
    slowly: 'Unele lucruri se citesc pe îndelete.',
    poetry: 'Poezie',
    empty: 'Următorul poem încă așteaptă să fie scris.',
    addFirst: 'Adaugă primul poem',
    closing: 'Lasă puțin loc',
    closingFor: 'pentru',
    unwritten: 'nescris.',
    footer: 'Un răgaz pentru tine.',
    back: 'Înapoi sus',
    close: 'Închide poemul',
    previous: '← Anteriorul',
    next: 'Următorul →',
    poemLanguage: 'Limba poemului',
    originalRomanian: 'Original în română',
    originalEnglish: 'Original în engleză',
    missing: 'Versiunea în română nu a fost încă adăugată.',
    readOriginal: 'Citește originalul în English (US)',
    addTranslation: 'Adaugă traducerea în Administrare',
    unavailableTitle: 'Poemele vor reveni.',
    unavailable: 'Colecția nu a putut fi încărcată. Încearcă din nou peste câteva clipe.',
    retry: 'Încearcă din nou',
    count: (n: number) => `${n} ${n === 1 ? 'poem' : 'poeme'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'vers' : 'versuri'}`,
    readBy: (title: string, author: string) => `Citește „${title}”, de ${author}`,
  },
  'en-US': {
    skip: 'Skip to poems',
    home: 'Poetio home',
    note: 'An independent poetry collection',
    navigation: 'Main navigation',
    administration: 'Administration',
    poems: 'The poems',
    author: 'Author',
    tagline: 'Words for the in-between',
    edition: 'A small collection · No. 01',
    takeTime: 'Take your time',
    collection: 'The collection',
    slowly: 'Some things are better read slowly.',
    poetry: 'Poetry',
    empty: 'The next poem is still unwritten.',
    addFirst: 'Add the first poem',
    closing: 'Leave a little room',
    closingFor: 'for the',
    unwritten: 'unwritten.',
    footer: 'A little room to breathe.',
    back: 'Back to top',
    close: 'Close poem',
    previous: '← Previous',
    next: 'Next poem →',
    poemLanguage: 'Poem language',
    originalRomanian: 'Romanian original',
    originalEnglish: 'English original',
    missing: 'The American English version has not been added yet.',
    readOriginal: 'Read the Romanian original',
    addTranslation: 'Add the translation in Administration',
    unavailableTitle: 'The poems will be back.',
    unavailable: 'The collection could not be loaded. Please try again in a moment.',
    retry: 'Try again',
    count: (n: number) => `${n} ${n === 1 ? 'poem' : 'poems'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`,
    readBy: (title: string, author: string) => `Read ${title} by ${author}`,
  },
  fr: {
    skip: 'Aller aux poèmes',
    home: 'Poetio — Accueil',
    note: 'Une collection indépendante de poésie',
    navigation: 'Navigation principale',
    administration: 'Administration',
    poems: 'Poèmes',
    author: 'Auteur',
    tagline: 'Des mots pour les instants suspendus',
    edition: 'Une petite collection · N°\u00a001',
    takeTime: 'Prenez votre temps',
    collection: 'La collection',
    slowly: 'Certaines choses se lisent lentement.',
    poetry: 'Poésie',
    empty: 'Le prochain poème attend encore d’être écrit.',
    addFirst: 'Ajouter le premier poème',
    closing: 'Laissez un peu de place',
    closingFor: 'pour',
    unwritten: 'ce qui reste à écrire.',
    footer: 'Un instant de répit.',
    back: 'Retour en haut',
    close: 'Fermer le poème',
    previous: '← Précédent',
    next: 'Poème suivant →',
    poemLanguage: 'Langue du poème',
    originalRomanian: 'Original en roumain',
    originalEnglish: 'Original en anglais',
    missing: 'La version française n’a pas encore été ajoutée.',
    readOriginal: 'Lire l’original',
    addTranslation: 'Ajouter la version française dans l’administration',
    unavailableTitle: 'Les poèmes reviendront.',
    unavailable: 'La collection n’a pas pu être chargée. Réessayez dans un instant.',
    retry: 'Réessayer',
    count: (n: number) => `${n} ${n <= 1 ? 'poème' : 'poèmes'}`,
    lineCount: (n: number) => `${n} vers`,
    readBy: (title: string, author: string) => `Lire «\u00a0${title}\u00a0», de ${author}`,
  },
  de: {
    skip: 'Zu den Gedichten springen',
    home: 'Poetio — Startseite',
    note: 'Eine unabhängige Gedichtsammlung',
    navigation: 'Hauptnavigation',
    administration: 'Verwaltung',
    poems: 'Gedichte',
    author: 'Autor',
    tagline: 'Worte für die Augenblicke dazwischen',
    edition: 'Eine kleine Sammlung · Nr.\u00a001',
    takeTime: 'Nehmen Sie sich Zeit',
    collection: 'Die Sammlung',
    slowly: 'Manches liest man besser langsam.',
    poetry: 'Lyrik',
    empty: 'Das nächste Gedicht wartet noch darauf, geschrieben zu werden.',
    addFirst: 'Das erste Gedicht hinzufügen',
    closing: 'Lassen Sie ein wenig Raum',
    closingFor: 'für',
    unwritten: 'das Ungeschriebene.',
    footer: 'Ein Moment zum Durchatmen.',
    back: 'Nach oben',
    close: 'Gedicht schließen',
    previous: '← Vorheriges',
    next: 'Nächstes Gedicht →',
    poemLanguage: 'Sprache des Gedichts',
    originalRomanian: 'Rumänisches Original',
    originalEnglish: 'Englisches Original',
    missing: 'Die deutsche Fassung wurde noch nicht hinzugefügt.',
    readOriginal: 'Original lesen',
    addTranslation: 'Die deutsche Fassung in der Verwaltung hinzufügen',
    unavailableTitle: 'Die Gedichte kommen wieder.',
    unavailable: 'Die Sammlung konnte nicht geladen werden. Versuchen Sie es gleich noch einmal.',
    retry: 'Erneut versuchen',
    count: (n: number) => `${n} ${n === 1 ? 'Gedicht' : 'Gedichte'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'Vers' : 'Verse'}`,
    readBy: (title: string, author: string) => `„${title}“ von ${author} lesen`,
  },
  es: {
    skip: 'Ir a los poemas',
    home: 'Poetio — Inicio',
    note: 'Una colección independiente de poesía',
    navigation: 'Navegación principal',
    administration: 'Administración',
    poems: 'Poemas',
    author: 'Autor',
    tagline: 'Palabras para los instantes intermedios',
    edition: 'Una pequeña colección · N.º\u00a001',
    takeTime: 'Sin prisa',
    collection: 'La colección',
    slowly: 'Algunas cosas se leen despacio.',
    poetry: 'Poesía',
    empty: 'El próximo poema aún espera ser escrito.',
    addFirst: 'Añadir el primer poema',
    closing: 'Deja un poco de espacio',
    closingFor: 'para',
    unwritten: 'lo no escrito.',
    footer: 'Un respiro para ti.',
    back: 'Volver arriba',
    close: 'Cerrar el poema',
    previous: '← Anterior',
    next: 'Poema siguiente →',
    poemLanguage: 'Idioma del poema',
    originalRomanian: 'Original en rumano',
    originalEnglish: 'Original en inglés',
    missing: 'La versión en español aún no se ha añadido.',
    readOriginal: 'Leer el original',
    addTranslation: 'Añadir la versión en español en la administración',
    unavailableTitle: 'Los poemas volverán.',
    unavailable: 'No se pudo cargar la colección. Inténtalo de nuevo en un momento.',
    retry: 'Reintentar',
    count: (n: number) => `${n} ${n === 1 ? 'poema' : 'poemas'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'verso' : 'versos'}`,
    readBy: (title: string, author: string) => `Leer «${title}», de ${author}`,
  },
  it: {
    skip: 'Vai alle poesie',
    home: 'Poetio — Home',
    note: 'Una collezione indipendente di poesia',
    navigation: 'Navigazione principale',
    administration: 'Amministrazione',
    poems: 'Poesie',
    author: 'Autore',
    tagline: 'Parole per gli istanti sospesi',
    edition: 'Una piccola collezione · N.\u00a001',
    takeTime: 'Con calma',
    collection: 'La collezione',
    slowly: 'Alcune cose si leggono lentamente.',
    poetry: 'Poesia',
    empty: 'La prossima poesia aspetta ancora di essere scritta.',
    addFirst: 'Aggiungi la prima poesia',
    closing: 'Lascia un po’ di spazio',
    closingFor: 'per',
    unwritten: 'ciò che non è ancora scritto.',
    footer: 'Un momento di respiro.',
    back: 'Torna su',
    close: 'Chiudi la poesia',
    previous: '← Precedente',
    next: 'Poesia successiva →',
    poemLanguage: 'Lingua della poesia',
    originalRomanian: 'Originale in rumeno',
    originalEnglish: 'Originale in inglese',
    missing: 'La versione italiana non è ancora stata aggiunta.',
    readOriginal: 'Leggi l’originale',
    addTranslation: 'Aggiungi la versione italiana nell’amministrazione',
    unavailableTitle: 'Le poesie torneranno.',
    unavailable: 'Non è stato possibile caricare la collezione. Riprova tra un momento.',
    retry: 'Riprova',
    count: (n: number) => `${n} ${n === 1 ? 'poesia' : 'poesie'}`,
    lineCount: (n: number) => `${n} ${n === 1 ? 'verso' : 'versi'}`,
    readBy: (title: string, author: string) => `Leggi «${title}», di ${author}`,
  },
};
