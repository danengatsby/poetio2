// Poems written into the browser-test database. The second one stores its
// Romanian text decomposed (NFD), as text pasted from some editors arrives.
export const OWNER_EMAIL = 'pensio53@gmail.com';

const meeting = 'Întâlnirea din crâng';

export const fixturePoems = [
  {
    title: meeting,
    author: 'Ana Probă',
    theme: 'Lumină de probă',
    content: `${meeting}\nare pași de frunză și de apă.\n\nÎn labirintul serii\nne găsim fără hartă.`,
    source_language: 'ro',
    translated_title: 'The meeting in the grove',
    translated_theme: 'Test light',
    translated_content:
      'The meeting in the grove\nhas steps of leaf and water.\n\nIn the labyrinth of evening\nwe find each other without a map.',
  },
  {
    title: 'Seara la margine'.normalize('NFD'),
    author: 'Ion Exemplu',
    theme: 'Lumină de probă'.normalize('NFD'),
    content: `Am uitat drumul spre casă.\n${meeting}\nm-a așteptat sub tei.`.normalize('NFD'),
    source_language: 'ro',
    translated_title: 'Evening at the edge',
    translated_theme: 'Test light',
    translated_content: 'I forgot the way home.\nThe meeting in the grove\nwaited for me under the linden.',
  },
  {
    title: 'The kettle and the rain',
    author: 'Mara Draft',
    theme: 'Weather',
    content: 'The kettle sings before the rain.\nThe window keeps a grey account.',
    source_language: 'en-US',
  },
];
