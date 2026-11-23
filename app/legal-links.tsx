import type { SiteLanguage } from '@/lib/poem-types';
import { pick, withSiteLanguage } from '@/lib/site-language';

/** The terms of sale and the privacy notice, in the footer of every public page. */
export default function LegalLinks({ language }: { language: SiteLanguage }) {
  return (
    <span className="legal-links">
      <a href={withSiteLanguage('/termeni', language)}>
        {pick(language, 'Termeni și condiții', 'Terms and conditions', 'Conditions générales', 'AGB')}
      </a>
      {' · '}
      <a href={withSiteLanguage('/confidentialitate', language)}>
        {pick(language, 'Confidențialitate', 'Privacy', 'Confidentialité', 'Datenschutz')}
      </a>
    </span>
  );
}
