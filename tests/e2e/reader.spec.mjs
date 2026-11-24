import { expect, openSelectedPoemPage, test } from './test.mjs';
import { fixturePoems } from './fixture.mjs';

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
  await openSelectedPoemPage(page);
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
  await openSelectedPoemPage(page);
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

test('the home page opens on the collection and a counted theme leads to another reading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const text of ['Fără grabă', 'Colecția', 'Unele lucruri se citesc pe îndelete.']) {
    await expect(page.locator('main').getByText(text, { exact: text !== 'Colecția' })).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    await page.locator('.collection-titles [aria-current]').innerText(),
  );
  await expect(page.getByRole('link', { name: 'Citește poemul', exact: true })).toHaveCount(0);
  const search = page.getByRole('search');
  await expect(search).toBeHidden();
  await page.getByText('Caută în colecție', { exact: true }).click();
  const themes = search.getByRole('combobox', { name: 'Temă', exact: true });
  await themes.selectOption({ label: 'Lumină de probă (2)' });
  await search.getByRole('button', { name: 'Caută', exact: true }).click();
  const cards = page.locator('[data-poem-id]');
  await expect(cards).toHaveCount(2);
  const collection = page.url();
  await cards.first().click();
  await openSelectedPoemPage(page);
  const first = page.url();
  const next = page.locator('.next-poem a');
  await expect(page.locator('.next-poem')).toContainText('Mai citește din tema');
  const title = (await next.innerText()).replace(/ →$/, '');
  await next.click();
  await expect(page).not.toHaveURL(first);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.locator('.content-back').click();
  await expect(cards).toHaveCount(2);
  expect(new URL(page.url()).searchParams.get('topic')).toBe(new URL(collection).searchParams.get('topic'));
});

test('choosing a title updates the highlighted item and the single reading panel', async ({ page }) => {
  await page.route('**/api/poems/*/comments?*', route => {
    const poemId = new URL(route.request().url()).pathname.split('/')[3];
    return route.fulfill({
      json: {
        comments: [{ id: 'test', name: 'Cititor', content: poemId, created_at: 1720000000000 }],
        total: 1,
        hasMore: false,
      },
    });
  });
  await page.goto('/?' + new URLSearchParams({ lang: 'ro', theme: fixturePoems[0].theme }));
  const links = page.locator('.collection-titles a');
  const article = page.locator('#selected-poem');
  await expect(links.first()).toHaveAttribute('aria-current', 'true');
  await expect(article.getByRole('heading', { level: 1 })).toHaveText(await links.first().innerText());
  const [first, second] = fixturePoems;
  const select = poem => links.filter({ hasText: poem.title });
  await select(first).click();
  await expect(article.getByRole('heading', { level: 1 })).toHaveText(first.title);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const left = await page.locator('.collection-titles').boundingBox();
    const right = await article.boundingBox();
    expect(left.x + left.width).toBeLessThan(right.x);
    expect(right.x + right.width).toBeLessThanOrEqual(width);
  }
  const audio = article.locator('audio');
  const oldAudio = await audio.elementHandle();
  const firstSource = await audio.getAttribute('src');
  await oldAudio.evaluate(element => element.play());
  const discussion = article.locator('.collection-verses + .poem-comments .comment-list p');
  await expect(discussion).toHaveText(await select(first).getAttribute('data-poem-id'));
  await select(second).focus();
  await page.keyboard.press('Enter');
  await expect(select(second)).toHaveAttribute('aria-current', 'true');
  await expect(audio).toHaveAttribute('src', /^\/api\/audio\//);
  expect(await audio.getAttribute('src')).not.toBe(firstSource);
  expect(await oldAudio.evaluate(element => element.paused && !element.hasAttribute('src'))).toBe(true);
  await expect(discussion).toHaveText(await select(second).getAttribute('data-poem-id'));
  await expect(page.locator('.collection-verses')).toHaveCount(1);
  expect(await page.locator('.collection-verses').textContent()).toBe(second.content);
  await expect(page.locator('.collection-titles [aria-current]')).toHaveCount(1);
  await page.goBack();
  await expect(select(first)).toHaveAttribute('aria-current', 'true');
  await page.goForward();
  await page.reload();
  await expect(article.getByRole('heading', { level: 1 })).toHaveText(second.title);
  await expect(select(second)).toHaveAttribute('aria-current', 'true');
  await expect(article.getByRole('link', { name: /Pagina poemului/ })).toHaveCount(0);
  await openSelectedPoemPage(page);
  await expect(page.locator('h1')).toHaveText(second.title);
  await page.locator('.content-back').click();
  await expect(select(second)).toHaveAttribute('aria-current', 'true');
  await page.goto('/?' + new URLSearchParams({ q: fixturePoems[2].title }));
  await expect(article.getByRole('heading', { level: 1 })).toHaveText(fixturePoems[2].title);
  await expect(article.locator('audio')).toHaveCount(0);
});

test('the public reader shows seven poems at a time and returns to the same first page', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('.collection-titles [data-poem-id]');
  await expect(links).toHaveCount(7);
  const first = await poemIds(page);
  await page.locator('.collection-pagination [rel=next]').click();
  await expect(page.locator('.collection-results')).toHaveText(/^8–/);
  const second = await poemIds(page);
  expect(second.length).toBeGreaterThan(0);
  expect(second.length).toBeLessThanOrEqual(7);
  expect(second.filter(id => first.includes(id))).toEqual([]);
  await expect(links.first()).toHaveAttribute('aria-current', 'true');
  await page.locator('.collection-pagination [rel=prev]').click();
  expect(await poemIds(page)).toEqual(first);
});
