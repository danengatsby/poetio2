// The site in German: the selector, the interface, poems with and without a German version, and the shop texts.
import { expect, test } from './test.mjs';
import { fixtureBook } from './fixture.mjs';

test('the language selector switches the collection to German', async ({ page }) => {
  await page.goto('/?' + new URLSearchParams({ theme: 'Lumină de probă' }));
  await page.getByRole('radio', { name: 'Deutsch' }).first().click();
  await expect(page).toHaveURL(/lang=de/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  const german = page.locator('a.poem-card', { hasText: 'Die Begegnung im Hain' });
  await german.click();
  await expect(page.locator('#selected-poem')).toContainText('Probelicht');
  await expect(german).toHaveAttribute('lang', 'de');
  await page.locator('a.poem-card', { hasText: 'Seara la margine'.normalize('NFD') }).click();
  await expect(page.locator('#selected-poem')).toContainText('Rumänisches Original');
  await expect(page.getByRole('search', { name: 'Sammlung durchsuchen' })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find(cookie => cookie.name === 'poetio-language')?.value).toBe('de');
});

test('a German poem page shows the German version and German comments', async ({ page }) => {
  await page.goto('/?lang=de');
  await page.locator('a.poem-card', { hasText: 'Die Begegnung im Hain' }).click();
  await page.locator('.collection-detail-link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Die Begegnung im Hain');
  await expect(page.locator('.poem-reading-text')).toContainText('finden wir uns ohne Karte.');
  await expect(page.locator('.poem-reading-text')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('link', { name: '← Zurück zur Sammlung' })).toBeVisible();
  await expect(page.getByLabel('Ihr Name')).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'de_DE');
  // The French version is still there.
  await page.goto(page.url().replace('lang=de', 'lang=fr'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('La rencontre au bosquet');
});

test('a poem without a German version shows its original with a note', async ({ page }) => {
  await page.goto('/?lang=de&q=kettle');
  await page
    .locator('.collection-titles')
    .getByRole('link', { name: /^The kettle/ })
    .click();
  await page.locator('.collection-detail-link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^The kettle/);
  await expect(page.getByText('Übersetzung nicht verfügbar; das Original wird angezeigt.')).toBeVisible();
});

test('the shop and its legal pages are in German', async ({ page }) => {
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1&lang=de`);
  await expect(page.getByRole('button', { name: 'In den Warenkorb' })).toBeVisible();
  await page.getByRole('link', { name: 'Jetzt kaufen' }).click();
  await expect(page.getByRole('button', { name: 'Zahlungspflichtig bestellen' })).toBeVisible();
  await page.goto('/termeni?lang=de');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Allgemeine Geschäftsbedingungen');
  await expect(page.locator('#retur')).toHaveText('Widerrufsrecht und Rücksendung');
  await expect(page.locator('.shop-withdrawal-form')).toContainText('Hiermit widerrufe ich');
  await page.goto('/confidentialitate?lang=de');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung');
  await page.goto('/autor?lang=de');
  await expect(page.getByRole('heading', { name: 'Kindheit und Ausbildung' })).toBeVisible();
});
