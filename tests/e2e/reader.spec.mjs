import { expect, test } from './test.mjs';

const meeting = 'Întâlnirea din crâng';
const poemIds = async page =>
  (await page.locator('[data-poem-id]').evaluateAll(cards => cards.map(card => card.dataset.poemId))).sort();

test('finds the same poems whether the query is composed, decomposed or unaccented', async ({ page }) => {
  const results = [];
  for (const query of [meeting, meeting.normalize('NFD'), 'Intalnirea din crang']) {
    await page.goto('/?' + new URLSearchParams({ lang: 'ro', q: query }) + '#collection');
    results.push(await poemIds(page));
  }
  // One poem stores its text composed, the other decomposed; both must match.
  expect(results[0]).toHaveLength(2);
  expect(results[1]).toEqual(results[0]);
  expect(results[2]).toEqual(results[0]);

  await page.goto('/?' + new URLSearchParams({ lang: 'ro', theme: 'Lumina de proba' }) + '#collection');
  expect(await poemIds(page)).toEqual(results[0]);
});

test('keeps the chosen language and search when returning to the collection', async ({ page }) => {
  await page.goto('/?' + new URLSearchParams({ lang: 'ro', q: 'labirintul' }) + '#collection');
  await page.locator('[data-poem-id]').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(meeting);

  await page.getByRole('radio', { name: 'English (US)' }).click();
  await expect(page).toHaveURL(/[?&]lang=en-US/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The meeting in the grove');

  await page.getByRole('link', { name: '← Back to collection' }).click();
  const url = new URL(page.url());
  expect(url.searchParams.get('lang')).toBe('en-US');
  expect(url.searchParams.get('q')).toBe('labirintul');
  await expect(page.getByRole('searchbox')).toHaveValue('labirintul');
  await expect(page.locator('[data-poem-id]')).toHaveCount(1);
});

test('copies a link that holds only the poem and its language', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  await page.goto('/?' + new URLSearchParams({ lang: 'ro', q: 'labirintul' }) + '#collection');
  await page.locator('[data-poem-id]').first().click();
  await page.getByRole('radio', { name: 'English (US)' }).click();
  await expect(page).toHaveURL(/[?&]lang=en-US/);
  const id = new URL(page.url()).pathname.split('/').at(-1);

  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/poeme/${id}?lang=en-US`);
});

test('collection pages have a canonical address and a sharing preview; favicon.ico exists', async ({
  page,
  request,
}) => {
  for (const [path, canonical, image] of [
    ['/', 'https://poetio.cloud/', '/assets/poetio-balloons.png'],
    ['/?lang=en-US', 'https://poetio.cloud/?lang=en-US', '/assets/poetio-balloons.png'],
    ['/carti', 'https://poetio.cloud/carti', '/assets/poetio-balloons.png'],
    ['/video', 'https://poetio.cloud/video', '/assets/poetio-balloons.png'],
    ['/autor', 'https://poetio.cloud/autor', '/assets/dan-enache.jpg'],
  ]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://poetio.cloud' + image);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Poetio/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  }
  // Every page carries the (report-only) Content Security Policy and the Permissions-Policy.
  const home = await request.get('/');
  expect(home.headers()['content-security-policy-report-only']).toContain("default-src 'self'");
  expect(home.headers()['permissions-policy']).toContain('camera=()');
  const report = await request.post('/api/csp-report', {
    headers: { 'Content-Type': 'application/csp-report' },
    data: JSON.stringify({ 'csp-report': { 'document-uri': 'http://127.0.0.1/', 'violated-directive': 'img-src' } }),
  });
  expect(report.status()).toBe(204);
  const icon = await request.get('/favicon.ico');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toMatch(/icon/);
  await page.goto('/');
  await expect(page.locator('link[rel="icon"][href="/favicon.ico"]')).toHaveCount(1);
  await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1);
});
