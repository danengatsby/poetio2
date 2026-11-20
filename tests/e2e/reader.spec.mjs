import { expect, test } from '@playwright/test';

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
