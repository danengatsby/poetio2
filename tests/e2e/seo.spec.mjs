// What search engines and feed readers see: hreflang with x-default, the multilingual sitemap and the RSS feed.
import { expect, test } from './test.mjs';
import { readFileSync } from 'node:fs';
import { fixturePoems, OWNER_EMAIL } from './fixture.mjs';

const [meeting] = fixturePoems;
// The editor test may rename this English-only poem; its title keeps this beginning.
const KETTLE = 'The kettle';
const SITE = 'https://poetio.cloud';

async function poemId(page, title) {
  await page.goto('/?' + new URLSearchParams({ q: title }));
  const card = page.locator('.collection-titles').getByRole('link', { name: title, exact: title !== KETTLE });
  return card.getAttribute('data-poem-id');
}

const wellFormed = (page, text) =>
  page.evaluate(
    source => !new DOMParser().parseFromString(source, 'application/xml').querySelector('parsererror'),
    text,
  );

test('a poem page names its language versions, x-default and the feed', async ({ page }) => {
  const id = await poemId(page, meeting.title);
  await page.goto(`/poeme/${id}?lang=it`);
  const alternates = page.locator('link[rel="alternate"][hreflang]');
  await expect(alternates).toHaveCount(7);
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', `${SITE}/poeme/${id}`);
  await expect(page.locator('link[hreflang="it"]')).toHaveAttribute('href', `${SITE}/poeme/${id}?lang=it`);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    `${SITE}/feed.xml?lang=it`,
  );
  // The poem opens with its title; the description starts after it.
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^ha passi di foglia/);

  const englishOnly = await poemId(page, KETTLE);
  await page.goto(`/poeme/${englishOnly}`);
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(2);
  await expect(page.locator('link[hreflang="en-US"]')).toHaveAttribute(
    'href',
    `${SITE}/poeme/${englishOnly}?lang=en-US`,
  );
});

test('collection pages list all six languages and x-default', async ({ page }) => {
  await page.goto('/?lang=de');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(7);
  await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', `${SITE}/`);
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
    'href',
    `${SITE}/feed.xml?lang=de`,
  );
});

test('the sitemap lists each language version once, and every address answers', async ({ page, request }) => {
  const id = await poemId(page, meeting.title);
  const englishOnly = await poemId(page, KETTLE);
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(await wellFormed(page, xml)).toBe(true);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(new Set(locs).size).toBe(locs.length);
  for (const language of ['', '?lang=en-US', '?lang=fr', '?lang=de', '?lang=es', '?lang=it'])
    expect(locs).toContain(`${SITE}/poeme/${id}${language}`);
  expect(locs).toContain(`${SITE}/poeme/${englishOnly}?lang=en-US`);
  expect(locs).not.toContain(`${SITE}/poeme/${englishOnly}?lang=it`);
  expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/poeme/${id}"/>`);
  for (const loc of locs) expect((await request.get(loc.replace(SITE, ''))).status(), loc).toBe(200);
});

test('the RSS feed carries the poems in the chosen language', async ({ page, request }) => {
  const id = await poemId(page, meeting.title);
  const response = await request.get('/feed.xml?lang=it');
  expect(response.headers()['content-type']).toContain('application/rss+xml');
  const xml = await response.text();
  expect(await wellFormed(page, xml)).toBe(true);
  expect(xml).toContain('<language>it</language>');
  expect(xml).toContain(`<title>${meeting.it_title}</title>`);
  expect(xml).toContain(`<link>${SITE}/poeme/${id}?lang=it</link>`);
  expect(xml).toContain('<description>ha passi di foglia');
  // Without an Italian version a poem appears as its original, as on the site.
  expect(xml).toContain(`<title>${KETTLE}`);

  const romanian = await (await request.get('/feed.xml')).text();
  expect(romanian).toContain('<language>ro</language>');
  expect(romanian).toContain(`<title>${meeting.title}</title>`);
  expect(romanian).toContain(`<link>${SITE}/poeme/${id}</link>`);
});

test('a film keeps one address in every site language and in the sitemap', async ({ page, request, baseURL }) => {
  const owner = { 'oai-authenticated-user-email': OWNER_EMAIL, Origin: baseURL };
  const file = crypto.randomUUID(),
    id = crypto.randomUUID();
  const upload = await request.post('/api/video-files', {
    headers: { ...owner, 'Content-Type': 'video/mp4', 'X-File-Name': 'clip.mp4', 'X-Upload-Id': file },
    data: readFileSync(new URL('../fixtures/media/clip.mp4', import.meta.url)),
  });
  expect(upload.status()).toBe(201);
  const data = {
    id,
    title: 'Film pentru căutare',
    author: 'Editor',
    description: 'Un film despre ploaie.',
    file_id: file,
  };
  await expect.poll(async () => (await request.post('/api/videos', { headers: owner, data })).status()).toBe(201);

  for (const language of ['', '?lang=fr']) {
    await page.goto(`/video/${id}${language}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE}/video/${id}`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE}/video/${id}`);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', data.description);
  }

  const xml = await (await request.get('/sitemap.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  expect(locs.filter(loc => loc.startsWith(`${SITE}/video/${id}`))).toEqual([`${SITE}/video/${id}`]);
  expect(xml).not.toContain(`${SITE}/video/${id}?lang=`);
  // The film collection itself is translated, so it still lists every language.
  for (const language of ['', '?lang=en-US', '?lang=it']) expect(locs).toContain(`${SITE}/video${language}`);

  expect((await request.delete('/api/videos/' + id, { headers: owner, data: { revision: 1 } })).ok()).toBe(true);
});
