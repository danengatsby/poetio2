import { getPoemDb } from '@/db/binding';
import { sitemapEntries } from '@/db/sitemap';
import { siteOrigin } from '@/lib/content-metadata';

export const dynamic = 'force-dynamic';

export async function GET() {
  const entries = await sitemapEntries(getPoemDb());
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries.map(entry => `<url><loc>${siteOrigin}${entry.path}</loc>${entry.updated ? `<lastmod>${new Date(entry.updated).toISOString()}</lastmod>` : ''}</url>`).join('') + '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}
