import type { PoemLanguage } from './poem-types';

export const biographySource = 'https://www.poetrysoup.com/poems_poets/poems_by_poet.aspx?ID=170815';

type Biography = {
  profile: { label: string; value: string }[];
  sections: { id: string; title: string; paragraphs: string[] }[];
};

// Full text supplied by the author, with a complete Romanian translation.
// The supplied encoding typo "Ia?i" is rendered as "Iași" in both languages.
export const danEnacheBiography: Record<PoemLanguage, Biography> = {
  ro: {
    profile: [
      { label: 'Nume', value: 'Dan Enache' },
      { label: 'Naționalitate', value: 'Română' },
      { label: 'Ocupație', value: 'Poet, mistic, filosof, scriitor romantic, poet ezoteric și oniric' },
    ],
    sections: [
      {
        id: 'early-life',
        title: 'Copilărie și educație',
        paragraphs: [
          'Născut în ținutul eteric al Moldovei, în orașul mistic Iași, Dan Enache a crescut printre dealuri domoale și mănăstiri străvechi, peisaje impregnate de o frumusețe tulburătoare și de o seninătate mistică. Această comuniune timpurie cu priveliștile atemporale ale naturii și cu bogata moștenire culturală i-a deschis aripile imaginației și i-a influențat profund sensibilitatea poetică. Afinitatea lui Enache pentru mistic, ezoteric și oniric s-a aprins în acești ani de formare, pe când străbătea peisaje pătrunse de folclor și legendă.',
          'Educația lui Enache a îmbinat școlarizarea tradițională cu explorarea autodidactă. A urmat studii de tehnologia informației la Universitatea Politehnica din București, cufundându-se în logica structurată și în creativitatea informaticii. Totuși, dialogul său solitar și profund cu natura și cu textele metafizice a fost cel care i-a modelat cu adevărat parcursul intelectual și spiritual.',
        ],
      },
      {
        id: 'poetic-career',
        title: 'Carieră poetică',
        paragraphs: [
          'Dan Enache s-a afirmat ca o voce poetică distinctă în literatura română, opera sa fiind caracterizată de o împletire complexă de misticism, melancolie, investigație filosofică și ezoterism oniric. Stilul său unic îmbină poeticul și filosoficul într-un dans armonios, creând versuri care stimulează intelectul și rezonează emoțional. Poezia sa, adesea amplă și curgătoare, transcende cotidianul și pătrunde în tărâmurile etericului și ale ezotericului. Tehnica narativă a lui Enache oglindește fluxul conștiinței, surprinzând natura evanescentă și trecătoare a experienței umane.',
          'Volumul de debut al lui Enache, „BEYOND THE REAL”, le-a prezentat cititorilor stilul său poetic-filosofic unic — un amestec de romantism, reflecții mistice, meditații existențiale și elemente onirice. Această lucrare a dat tonul volumelor sale ulterioare, în care vocea sa s-a maturizat într-o îmbinare armonioasă a magicului cu filosoficul, a melancolicului cu misticul.',
        ],
      },
      {
        id: 'themes',
        title: 'Teme și influență',
        paragraphs: [
          'Poezia lui Enache este străbătută de teme recurente precum explorarea interioară, căutarea adevărului și tensiunea dintre individualitate și normele sociale. Opera sa îi provoacă pe cititori să privească dincolo de fațada exterioară a realității, îndemnând la introspecție profundă și la întoarcerea către sine. Legătura dintre lumină și umbră, contrastul dintre iluzie și realitate și jocul dintre tăcere și sunet sunt motive mereu prezente în scrisul său.',
          'Fundamentele filosofice ale operei lui Enache se vădesc în felul în care abordează dilemele existențiale moderne, blazarea vieții contemporane și căutarea sensului într-un univers aparent indiferent. El împletește într-un mod unic aceste teme apăsătoare cu o aură de misticism, romantism și ezoterism oniric, dând poeziei sale atât forță de stimulare intelectuală, cât și rezonanță emoțională.',
        ],
      },
      {
        id: 'legacy',
        title: 'Moștenire literară',
        paragraphs: [
          'Dan Enache continuă să captiveze și să inspire cititorii prin versurile sale de o frumusețe tulburătoare, învăluite în vis. Contribuțiile sale la literatura română au conturat un spațiu în care misticul și filosoficul se întâlnesc, oferind o explorare profundă și unică a condiției umane. Opera lui Enache mărturisește puterea poeziei de a transcende vizibilul, invitându-ne la o comuniune mai adâncă cu tărâmurile nevăzute, simțite, visate și imaginate ale existenței.',
        ],
      },
      {
        id: 'conclusion',
        title: 'Concluzie',
        paragraphs: [
          'Dan Enache rămâne o prezență luminoasă în poezia română, opera sa fiind o tapiserie strălucitoare de magie, melancolie, misticism, vise onirice și profunzime filosofică. Stilul său poetic-filosofic unic trezește emoții și mișcă sufletul, făcând ca vocea sa să continue să răsune în analele istoriei literare și invitând generațiile viitoare să călătorească alături de el în explorarea peisajelor interioare infinite.',
        ],
      },
    ],
  },
  'en-US': {
    profile: [
      { label: 'Name', value: 'Dan Enache' },
      { label: 'Nationality', value: 'Romanian' },
      { label: 'Occupation', value: 'Poet, Mystic, Philosopher, Romantic Writer, Esoteric and Oniric Poet' },
    ],
    sections: [
      {
        id: 'early-life',
        title: 'Early Life and Education',
        paragraphs: [
          "Born in the ethereal region of Moldova, in the mystic city of Iași, Dan Enache grew up amidst rolling hills and ancient monasteries, landscapes imbued with haunting beauty and mystical serenity. This early communion with timeless natural vistas and rich cultural heritage unfurled the wings of his imagination and profoundly influenced his poetic sensibilities. Enache's affinity for the mystical, the esoteric, and the dreamlike was kindled during these formative years as he wandered through landscapes steeped in folklore and legend.",
          "Enache's education was a blend of traditional schooling and autodidactic exploration. He pursued formal studies in information technology at the Politehnica University of Bucharest, immersing himself in the structured logic and creativity of computing. However, it was his solitary, profound dialogue with nature and metaphysical texts that truly shaped his intellectual and spiritual journey.",
        ],
      },
      {
        id: 'poetic-career',
        title: 'Poetic Career',
        paragraphs: [
          "Dan Enache emerged as a distinguished poetic voice in Romanian literature, his work characterized by an intricate weave of mysticism, melancholy, philosophical inquiry, and oniric esotericism. His unique style blends the poetic and the philosophical in a harmonious dance, creating verses that are both intellectually stimulating and emotionally resonant. His poetry, often long and flowing, transcends the mundane, delving into realms of the ethereal and the esoteric. Enache's narrative technique mirrors the stream of consciousness, capturing the elusive and transient nature of human experience.",
          'Enache\'s debut collection, "BEYOND THE REAL", introduced readers to his unique poetic-philosophical style—an amalgamation of romanticism, mystical reflections, existential musings, and oniric elements. This work set the tone for his subsequent collections, where his voice matured into a harmonious blend of the magical and the philosophical, the melancholic and the mystical.',
        ],
      },
      {
        id: 'themes',
        title: 'Themes and Influence',
        paragraphs: [
          "Enache's poetry is imbued with recurring themes of inner exploration, the quest for truth, and the tension between individuality and societal norms. His work challenges readers to look beyond the external facade of reality, urging deep introspection and a return to the self. The nexus of light and shadow, the contrast between illusion and reality, and the interplay of silence and sound are ever-present motifs in his writing.",
          "The philosophical underpinnings of Enache's work are evident in his treatment of modern existential dilemmas, the ennui of contemporary life, and the search for meaning in a seemingly indifferent universe. He uniquely intertwines these weighty themes with an aura of mysticism, romance, and oniric esotericism, rendering his poetry both intellectually stimulating and emotionally resonant.",
        ],
      },
      {
        id: 'legacy',
        title: 'Legacy',
        paragraphs: [
          "Dan Enache continues to captivate and inspire readers with his hauntingly beautiful, dreamlike verses. His contributions to Romanian literature have carved out a space where the mystical and the philosophical converge, offering a profound and unique exploration of the human condition. Enache's work is a testament to the power of poetry to transcend the visible, inviting us into a deeper communion with the unseen, the felt, the dreamt, and the imagined realms of existence.",
        ],
      },
      {
        id: 'conclusion',
        title: 'Conclusion',
        paragraphs: [
          'Dan Enache remains a luminary in Romanian poetry, his work a shimmering tapestry of magic, melancholy, mysticism, oniric dreams, and philosophical depth. His unique poetic-philosophical style evokes emotion and stirs the soul, ensuring that his voice will continue to echo in the annals of literary history, inviting future generations to journey alongside him in the exploration of infinite inner landscapes.',
        ],
      },
    ],
  },
};
