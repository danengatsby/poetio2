import { expect, test } from './test.mjs';
import { OWNER_EMAIL, fixtureBook } from './fixture.mjs';

// tests/e2e/server.mjs installs MaxMind's test database, where these addresses
// are London and Linköping. nginx sets X-Real-IP in production.
const READER_IP = '81.2.69.142';
const OWNER_IP = '89.160.20.112';

const reported = page =>
  page.waitForResponse(response => response.url().endsWith('/api/visits') && response.request().method() === 'POST');

test('a reader’s pages appear in /admin/vizite with IP and place; the owner’s own reading does not', async ({
  browser,
}) => {
  // A visitor's own CF-Connecting-IP / CF-IPCountry are ignored on the VPS: only nginx's X-Real-IP counts.
  const reader = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': READER_IP, 'cf-connecting-ip': OWNER_IP, 'cf-ipcountry': 'XX' },
  });
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
  await expect(ownPage.getByRole('heading', { name: 'Accesări' })).toBeVisible();
  await expect(ownPage.locator('.visits-access thead th')).toHaveText([
    'Data',
    'Ora',
    'IP',
    'Locația',
    'Sursa',
    'Dispozitiv',
    'Pagini și pași',
    'Comanda',
  ]);
  const card = ownPage.locator('.visits-access tbody tr').filter({ hasText: READER_IP });
  await expect(card).toHaveCount(1);
  await expect(card.locator('[data-label="Ora"]')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(card.locator('[data-label="Locația"]')).toHaveText('London, England, Regatul Unit');
  await expect(card.locator('[data-label="Sursa"]')).toHaveText('Intrare directă');
  await expect(card.locator('[data-label="Dispozitiv"]')).toContainText(/^Calculator\s*Chrome \d+/);
  await expect(card.locator('[data-label="Comanda"]')).toHaveText('—');
  await expect(card.locator('summary')).toHaveText('2 pagini');
  await card.locator('summary').click();
  await expect(card.getByRole('link', { name: 'Prima pagină' })).toBeVisible();
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

test('the visit in which a reader places an order shows it in the Accesări table', async ({ browser }) => {
  // Milton, Washington, United States in MaxMind's test database.
  const BUYER_IP = '216.160.83.56';
  const buyer = await browser.newContext({ extraHTTPHeaders: { 'x-real-ip': BUYER_IP } });
  const page = await buyer.newPage();
  let report = reported(page);
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1`);
  expect((await report).status()).toBe(204);
  // The order goes out from the page, as the checkout sends it, and the buyer lands on its page.
  const placed = await page.evaluate(async book => {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ion Cumpărător',
        email: 'ion@example.com',
        phone: '0733 999 888',
        address: 'Str. Lungă 2',
        city: 'Cluj-Napoca',
        county: 'Cluj',
        payment_method: 'cod',
        accept_terms: true,
        items: [{ book_id: book, cover: 1, quantity: 1 }],
      }),
    });
    return { status: response.status, ...(await response.json()) };
  }, fixtureBook.record.id);
  expect(placed.status).toBe(201);
  report = reported(page);
  await page.goto(`/comanda/${placed.order.id}?cheie=${placed.order.key}`);
  expect((await report).status()).toBe(204);
  await buyer.close();

  const owner = await browser.newContext({ extraHTTPHeaders: { 'oai-authenticated-user-email': OWNER_EMAIL } });
  const ownPage = await owner.newPage();
  await ownPage.goto('/admin/vizite');
  const row = ownPage.locator('.visits-access tbody tr').filter({ hasText: BUYER_IP });
  await expect(row).toHaveCount(1);
  await expect(row).toHaveClass(/visits-row-order/);
  const order = row.locator('[data-label="Comanda"]');
  await expect(order).toContainText(`nr. ${placed.order.number}`);
  await expect(order).toContainText('Nouă');
  await expect(order).not.toContainText('revăzută');
  await row.locator('summary').click();
  await expect(row.getByRole('link', { name: /^Cumpără: / })).toBeVisible();
  await expect(row.getByRole('link', { name: `Pagina comenzii nr. ${placed.order.number}` })).toBeVisible();

  // On a phone each visit is a card with labelled fields, inside the screen.
  await ownPage.setViewportSize({ width: 390, height: 844 });
  await expect(row.locator('[data-label="Comanda"]')).toBeVisible();
  expect(await ownPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await owner.close();
});
