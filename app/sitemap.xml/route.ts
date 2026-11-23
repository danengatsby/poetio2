import { getPoemDb } from '@/db/binding';
import { sitemapEntries } from '@/db/sitemap';
import { languageAlternates, languagePath, siteOrigin } from '@/lib/content-metadata';

export const dynamic = 'force-dynamic';

const xml = (text: string) => text.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

export async function GET() {
  const entries = await sitemapEntries(getPoemDb());
  const urls = entries.flatMap(({ path, updated, languages }) => {
    const lastmod = updated ? `<lastmod>${new Date(updated).toISOString()}</lastmod>` : '';
    if (!languages) return [`<url><loc>${xml(siteOrigin + path)}</loc>${lastmod}</url>`];
    const links = Object.entries(languageAlternates(path, languages))
      .map(([hreflang, href]) => `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${xml(href)}"/>`)
      .join('');
    // The address without a language is the Romanian page and x-default, so every
    // page keeps exactly one such entry; each other language version follows it.
    const addresses = [
      path,
      ...languages.filter(language => language !== 'ro').map(language => languagePath(path, language)),
    ];
    return addresses.map(address => `<url><loc>${xml(siteOrigin + address)}</loc>${lastmod}${links}</url>`);
  });
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls.join('') +
    '</urlset>';
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
