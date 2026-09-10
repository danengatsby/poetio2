import type { PoemLanguage } from './poem-types';

export const biographySource = 'https://www.poetrysoup.com/poems_poets/poems_by_poet.aspx?ID=170815';

// Summarized from the author's public profile, which links to Poetio.
export const danEnacheBiography: Record<PoemLanguage, string[]> = {
  ro: [
    'Dan Enache este un poet român originar din Iași. A studiat tehnologia informației la Universitatea Politehnica din București și și-a cultivat, prin lecturi și explorare personală, interesul pentru filosofie, natură și universul interior.',
    'Poezia sa îmbină romantismul cu reflecția filosofică și imaginile onirice. Iubirea, căutarea sensului și granița dintre iluzie și realitate revin în versurile sale. Volumul de debut, „Beyond the Real”, exprimă această apropiere dintre poezie și meditație.',
  ],
  'en-US': [
    'Dan Enache is a Romanian poet from Iași. He studied information technology at the Politehnica University of Bucharest, while independent reading and personal exploration nurtured his interest in philosophy, nature, and inner life.',
    'His poetry brings together romanticism, philosophical reflection, and dreamlike imagery. Love, the search for meaning, and the boundary between illusion and reality recur throughout his writing. His debut collection, “Beyond the Real,” reflects this connection between poetry and contemplation.',
  ],
};
