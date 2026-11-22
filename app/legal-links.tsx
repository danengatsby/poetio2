import type { PoemLanguage } from '@/lib/poem-types';
import { withSiteLanguage } from '@/lib/site-language';

/** The terms of sale and the privacy notice, in the footer of every public page. */
export default function LegalLinks({ language }: { language: PoemLanguage }) {
  const ro = language === 'ro';
  return (
    <span className="legal-links">
      <a href={withSiteLanguage('/termeni', language)}>{ro ? 'Termeni și condiții' : 'Terms and conditions'}</a>
      {' · '}
      <a href={withSiteLanguage('/confidentialitate', language)}>{ro ? 'Confidențialitate' : 'Privacy'}</a>
    </span>
  );
}
