// RSS 2.0 feed of the newest poems, in the language given by ?lang= (Romanian without it).
// Each item carries the beginning of the poem and links to its page, where it is read in full.
import { getPoemDb } from '@/db/binding';
import { feedPoems } from '@/db/poem-collection';
import { contentPath, excerpt, feedTitle, languagePath, siteIntro, siteOrigin } from '@/lib/content-metadata';
import { withoutLeadingTitle } from '@/lib/poem-collection';
import { pick, siteLanguage } from '@/lib/site-language';

export const dynamic = 'force-dynamic';

const xml = (text: string) => text.replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);
const rssDate = (time: number) => new Date(time).toUTCString();

export async function GET(request: Request) {
  const language = siteLanguage(new URL(request.url).searchParams.get('lang'));
  const poems = await feedPoems(getPoemDb(), language);
  const items = poems.map(poem => {
    const link = siteOrigin + languagePath(contentPath('poem', poem.id), language);
    return (
      '<item>' +
      `<title>${xml(poem.title)}</title>` +
      `<link>${xml(link)}</link>` +
      `<guid isPermaLink="true">${xml(link)}</guid>` +
      `<pubDate>${rssDate(poem.created_at)}</pubDate>` +
      (poem.author ? `<dc:creator>${xml(poem.author)}</dc:creator>` : '') +
      (poem.theme ? `<category>${xml(poem.theme)}</category>` : '') +
      `<description>${xml(excerpt(withoutLeadingTitle(poem.content, poem.title), poem.title))}</description>` +
      '</item>'
    );
  });
  const self = siteOrigin + languagePath('/feed.xml', language);
  const updated = Math.max(0, ...poems.map(poem => poem.updated_at));
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<channel>' +
    `<title>${xml(feedTitle(language))}</title>` +
    `<link>${xml(siteOrigin + languagePath('/', language))}</link>` +
    `<description>${xml(siteIntro[language].description)}</description>` +
    `<language>${pick(language, 'ro', 'en-us', 'fr', 'de', 'es', 'it')}</language>` +
    `<atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>` +
    (updated ? `<lastBuildDate>${rssDate(updated)}</lastBuildDate>` : '') +
    items.join('') +
    '</channel></rss>';
  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
}
