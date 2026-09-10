import type { PoemLanguage } from '@/lib/poem-types';
import Image from 'next/image';
import { biographySource, danEnacheBiography } from '@/lib/dan-enache';
import './about-poetio.css';

const copy = {
  ro: {
    about: 'Despre Poetio',
    biography: 'Biografie',
    portrait: 'Portretul lui Dan Enache',
    read: 'Descoperă poemele',
    source: 'Biografia autorului pe PoetrySoup',
  },
  'en-US': {
    about: 'About Poetio',
    biography: 'Biography',
    portrait: 'Portrait of Dan Enache',
    read: 'Explore the poems',
    source: 'Author biography on PoetrySoup',
  },
};

type AboutPoetioProps = {
  language: PoemLanguage;
  portrait: { src: string; width: number; height: number };
};

export default function AboutPoetio({ language, portrait }: AboutPoetioProps) {
  const text = copy[language];

  return <section id="about" className="about-poetio shell" aria-labelledby="about-title" lang={language}>
    <div className="about-portrait">
      <Image src={portrait.src} alt={text.portrait} width={portrait.width} height={portrait.height} loading="eager" decoding="async" fetchPriority="high" unoptimized />
    </div>
    <article className="about-story">
      <p className="eyebrow">{text.about}</p>
      <div className="about-content">
        <p className="about-label">{text.biography}</p>
        <h2 id="about-title">Dan Enache</h2>
        <div className="about-biography">
          {danEnacheBiography[language].map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <a className="about-source" href={biographySource} target="_blank" rel="noopener noreferrer">{text.source} <span aria-hidden="true">↗</span></a>
      </div>
      <a className="read-link" href="#collection">{text.read} <span className="circle-arrow" aria-hidden="true">↗</span></a>
    </article>
  </section>;
}
