import { expect, test } from '@playwright/test';
import { OWNER_EMAIL } from './fixture.mjs';

// tests/e2e/server.mjs installs MaxMind's test database, where these addresses
// are London and Linköping. nginx sets X-Real-IP in production.
const READER_IP = '81.2.69.142';
const OWNER_IP = '89.160.20.112';

const reported = page =>
  page.waitForResponse(response => response.url().endsWith('/api/visits') && response.request().method() === 'POST');

test('a reader’s pages appear in /admin/vizite with IP and place; the owner’s own reading does not', async ({
  browser,
}) => {
  const reader = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': READER_IP } });
  const page = await reader.newPage();
  let report = reported(page);
  await page.goto('/');
  expect((await report).status()).toBe(204);
  // Moving to a poem inside the site is the second page of the same visit.
  report = reported(page);
  await page.locator('a.poem-card').first().click();
  await expect(page).toHaveURL(/\/poeme\//);
  expect((await report).status()).toBe(204);
  await reader.close();

  const owner = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': OWNER_IP, 'oai-authenticated-user-email': OWNER_EMAIL },
  });
  const ownPage = await owner.newPage();
  report = reported(ownPage);
  await ownPage.goto('/autor');
  expect((await report).status()).toBe(204);

  await ownPage.goto('/admin/vizite');
  await expect(ownPage.getByRole('heading', { name: 'Vizite', level: 1 })).toBeVisible();
  const card = ownPage.locator('.visits-session').filter({ hasText: READER_IP });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('London, England, Regatul Unit');
  await expect(card).toContainText('Calculator · Chrome');
  await expect(card.locator('summary')).toHaveText('2 pagini');
  await card.locator('summary').click();
  await expect(card.getByRole('link', { name: /^Poem: / })).toBeVisible();
  await expect(ownPage.getByRole('button', { name: OWNER_IP })).toHaveCount(0);
  await expect(ownPage.locator('.visits-ranking').filter({ hasText: 'Localități' })).toContainText('London');
  await expect(ownPage.getByText('baza GeoIP2-City', { exact: false })).toBeVisible();

  // One IP's visits only, and back.
  await card.getByRole('button', { name: READER_IP }).click();
  await expect(ownPage.getByText(`Doar vizitele de la IP-ul ${READER_IP}.`)).toBeVisible();
  await expect(
    ownPage.locator('.visits-tiles > div').filter({ hasText: 'Pagini vizualizate' }).locator('dd'),
  ).toHaveText('2');
  await ownPage.getByRole('button', { name: 'Arată toate IP-urile' }).click();
  await expect(ownPage.getByText(`Doar vizitele de la IP-ul`)).toHaveCount(0);

  // The chart answers on focus as well as on hover, and its numbers are in a table.
  await ownPage.getByRole('button', { name: '24 de ore' }).click();
  await expect(ownPage.getByRole('heading', { name: 'Vizitatori pe oră' })).toBeVisible();
  await ownPage.getByText('Vezi cifrele în tabel').click();
  await expect(ownPage.locator('.visits-table tbody tr')).toHaveCount(25);
  await owner.close();
});

test('the owner can stop counting visits from their own browser', async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': '2.125.160.216' } });
  const page = await context.newPage();
  await page.goto('/termeni');
  await page.evaluate(() => localStorage.setItem('poetio-vizite-ignora', '1'));
  let sent = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/visits')) sent++;
  });
  await page.goto('/carti');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(500);
  expect(sent).toBe(0);
  await context.close();
});
