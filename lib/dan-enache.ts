import type { SiteLanguage } from './poem-types';

export const biographySource = 'https://www.poetrysoup.com/poems_poets/poems_by_poet.aspx?ID=170815';

type Biography = {
  profile: { label: string; value: string }[];
  sections: { id: string; title: string; paragraphs: string[] }[];
};

// Full text supplied by the author, with complete Romanian, French and German translations.
// The supplied encoding typo "Ia?i" is rendered as "Iași" in both languages.
export const danEnacheBiography: Record<SiteLanguage, Biography> = {
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
  fr: {
    profile: [
      { label: 'Nom', value: 'Dan Enache' },
      { label: 'Nationalité', value: 'Roumaine' },
      { label: 'Profession', value: 'Poète, mystique, philosophe, écrivain romantique, poète ésotérique et onirique' },
    ],
    sections: [
      {
        id: 'early-life',
        title: 'Enfance et formation',
        paragraphs: [
          'Né dans la contrée éthérée de la Moldavie, dans la ville mystique de Iași, Dan Enache a grandi parmi les collines ondoyantes et les monastères anciens, des paysages empreints d’une beauté obsédante et d’une sérénité mystique. Cette communion précoce avec des panoramas naturels intemporels et un riche héritage culturel a déployé les ailes de son imagination et a profondément marqué sa sensibilité poétique. L’attrait d’Enache pour le mystique, l’ésotérique et l’onirique s’est éveillé pendant ces années de formation, au fil de ses errances dans des paysages imprégnés de folklore et de légende.',
          'La formation d’Enache a mêlé scolarité traditionnelle et exploration autodidacte. Il a étudié les technologies de l’information à l’Université Politehnica de Bucarest, s’immergeant dans la logique structurée et la créativité de l’informatique. C’est pourtant son dialogue solitaire et profond avec la nature et les textes métaphysiques qui a véritablement façonné son parcours intellectuel et spirituel.',
        ],
      },
      {
        id: 'poetic-career',
        title: 'Parcours poétique',
        paragraphs: [
          'Dan Enache s’est imposé comme une voix poétique singulière de la littérature roumaine, son œuvre se distinguant par un entrelacs subtil de mysticisme, de mélancolie, de questionnement philosophique et d’ésotérisme onirique. Son style unique unit le poétique et le philosophique dans une danse harmonieuse, donnant des vers à la fois stimulants pour l’intellect et riches en résonance émotionnelle. Sa poésie, souvent ample et fluide, dépasse le quotidien pour s’aventurer dans les royaumes de l’éthéré et de l’ésotérique. La technique narrative d’Enache épouse le flux de la conscience et saisit la nature fuyante et passagère de l’expérience humaine.',
          'Le premier recueil d’Enache, « BEYOND THE REAL », a fait découvrir aux lecteurs son style poético-philosophique unique — un mélange de romantisme, de réflexions mystiques, de méditations existentielles et d’éléments oniriques. Cette œuvre a donné le ton de ses recueils suivants, où sa voix a mûri en une alliance harmonieuse du magique et du philosophique, du mélancolique et du mystique.',
        ],
      },
      {
        id: 'themes',
        title: 'Thèmes et influence',
        paragraphs: [
          'La poésie d’Enache est traversée de thèmes récurrents : l’exploration intérieure, la quête de vérité et la tension entre l’individualité et les normes sociales. Son œuvre invite le lecteur à regarder au-delà de la façade extérieure de la réalité, à une introspection profonde et à un retour à soi. Le lien entre la lumière et l’ombre, le contraste entre l’illusion et la réalité, le jeu du silence et du son sont des motifs toujours présents dans son écriture.',
          'Les fondements philosophiques de l’œuvre d’Enache apparaissent dans sa manière d’aborder les dilemmes existentiels modernes, l’ennui de la vie contemporaine et la quête de sens dans un univers apparemment indifférent. Il entrelace de façon unique ces thèmes graves avec une aura de mysticisme, de romantisme et d’ésotérisme onirique, ce qui rend sa poésie à la fois stimulante pour l’esprit et émouvante.',
        ],
      },
      {
        id: 'legacy',
        title: 'Héritage',
        paragraphs: [
          'Dan Enache continue de captiver et d’inspirer les lecteurs par ses vers d’une beauté obsédante, empreints de rêve. Ses contributions à la littérature roumaine ont ouvert un espace où le mystique et le philosophique se rejoignent, offrant une exploration profonde et singulière de la condition humaine. L’œuvre d’Enache témoigne du pouvoir de la poésie de dépasser le visible et nous invite à une communion plus intime avec les royaumes invisibles, ressentis, rêvés et imaginés de l’existence.',
        ],
      },
      {
        id: 'conclusion',
        title: 'Conclusion',
        paragraphs: [
          'Dan Enache demeure une figure lumineuse de la poésie roumaine, son œuvre étant une tapisserie chatoyante de magie, de mélancolie, de mysticisme, de rêves oniriques et de profondeur philosophique. Son style poético-philosophique unique éveille l’émotion et remue l’âme, afin que sa voix continue de résonner dans les annales de l’histoire littéraire et invite les générations futures à l’accompagner dans l’exploration d’infinis paysages intérieurs.',
        ],
      },
    ],
  },
  de: {
    profile: [
      { label: 'Name', value: 'Dan Enache' },
      { label: 'Nationalität', value: 'Rumänisch' },
      {
        label: 'Tätigkeit',
        value: 'Dichter, Mystiker, Philosoph, romantischer Schriftsteller, esoterischer und onirischer Dichter',
      },
    ],
    sections: [
      {
        id: 'early-life',
        title: 'Kindheit und Ausbildung',
        paragraphs: [
          'Geboren in der ätherischen Landschaft der Moldau, in der mystischen Stadt Iași, wuchs Dan Enache zwischen sanften Hügeln und alten Klöstern auf, in Landschaften voll betörender Schönheit und mystischer Ruhe. Diese frühe Verbundenheit mit zeitlosen Naturbildern und einem reichen kulturellen Erbe beflügelte seine Vorstellungskraft und prägte seine dichterische Empfindsamkeit tief. Enaches Neigung zum Mystischen, Esoterischen und Traumhaften erwachte in diesen prägenden Jahren, als er durch Landschaften voller Volkskunde und Legenden streifte.',
          'Enaches Ausbildung verband herkömmliche Schulbildung mit autodidaktischem Erkunden. Er studierte Informationstechnologie an der Politehnica-Universität Bukarest und vertiefte sich in die strukturierte Logik und die Kreativität der Informatik. Doch erst sein einsamer, tiefer Dialog mit der Natur und mit metaphysischen Texten prägte seinen geistigen und spirituellen Weg wirklich.',
        ],
      },
      {
        id: 'poetic-career',
        title: 'Dichterischer Werdegang',
        paragraphs: [
          'Dan Enache hat sich als eigenständige dichterische Stimme der rumänischen Literatur etabliert; sein Werk zeichnet sich durch ein feines Geflecht aus Mystik, Melancholie, philosophischem Fragen und onirischer Esoterik aus. Sein unverwechselbarer Stil verbindet das Poetische und das Philosophische in einem harmonischen Tanz und schafft Verse, die zugleich den Verstand anregen und das Gefühl berühren. Seine oft weit ausgreifende, fließende Lyrik übersteigt das Alltägliche und dringt in die Bereiche des Ätherischen und Esoterischen vor. Enaches Erzähltechnik folgt dem Bewusstseinsstrom und fängt das Flüchtige und Vergängliche menschlicher Erfahrung ein.',
          'Enaches erster Gedichtband, „BEYOND THE REAL“, machte die Leser mit seinem einzigartigen poetisch-philosophischen Stil bekannt — einer Verbindung aus Romantik, mystischen Betrachtungen, existenziellen Gedanken und onirischen Elementen. Dieses Werk gab den Ton für seine weiteren Bände vor, in denen seine Stimme zu einer harmonischen Verbindung des Magischen und des Philosophischen, des Melancholischen und des Mystischen reifte.',
        ],
      },
      {
        id: 'themes',
        title: 'Themen und Wirkung',
        paragraphs: [
          'Enaches Lyrik durchziehen wiederkehrende Themen: die innere Erkundung, die Suche nach Wahrheit und die Spannung zwischen Individualität und gesellschaftlichen Normen. Sein Werk fordert die Leser auf, hinter die äußere Fassade der Wirklichkeit zu blicken, und lädt zu tiefer Selbstbetrachtung und zur Rückkehr zu sich selbst ein. Die Verbindung von Licht und Schatten, der Gegensatz von Illusion und Wirklichkeit und das Wechselspiel von Stille und Klang sind stets gegenwärtige Motive seines Schreibens.',
          'Die philosophischen Grundlagen von Enaches Werk zeigen sich in seiner Auseinandersetzung mit modernen existenziellen Fragen, dem Überdruss des heutigen Lebens und der Suche nach Sinn in einem scheinbar gleichgültigen Universum. Auf einzigartige Weise verflicht er diese gewichtigen Themen mit einer Aura aus Mystik, Romantik und onirischer Esoterik, sodass seine Lyrik zugleich geistig anregend und bewegend ist.',
        ],
      },
      {
        id: 'legacy',
        title: 'Vermächtnis',
        paragraphs: [
          'Dan Enache fesselt und inspiriert seine Leser weiterhin mit seinen betörend schönen, traumhaften Versen. Seine Beiträge zur rumänischen Literatur haben einen Raum geschaffen, in dem sich das Mystische und das Philosophische begegnen, und bieten eine tiefe, eigenständige Erkundung der menschlichen Existenz. Enaches Werk bezeugt die Kraft der Dichtung, das Sichtbare zu überschreiten, und lädt uns zu einer innigeren Verbindung mit den unsichtbaren, gefühlten, geträumten und vorgestellten Bereichen des Daseins ein.',
        ],
      },
      {
        id: 'conclusion',
        title: 'Schluss',
        paragraphs: [
          'Dan Enache bleibt eine leuchtende Gestalt der rumänischen Lyrik; sein Werk ist ein schimmerndes Gewebe aus Magie, Melancholie, Mystik, onirischen Träumen und philosophischer Tiefe. Sein einzigartiger poetisch-philosophischer Stil weckt Gefühle und bewegt die Seele, sodass seine Stimme in der Literaturgeschichte weiterklingen und künftige Generationen einladen wird, ihn bei der Erkundung unendlicher innerer Landschaften zu begleiten.',
        ],
      },
    ],
  },
};
