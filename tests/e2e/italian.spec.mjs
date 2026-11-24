// The site in Italian: the selector, the interface, poems with and without an Italian version, and the shop texts.
import { expect, test } from './test.mjs';
import { fixtureBook } from './fixture.mjs';

test('the language selector switches the collection to Italian', async ({ page }) => {
  await page.goto('/?' + new URLSearchParams({ theme: 'Lumină de probă' }));
  await page.getByRole('radio', { name: 'Italiano' }).first().click();
  await expect(page).toHaveURL(/lang=it/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  const italian = page.locator('a.poem-card', { hasText: 'L’incontro nel boschetto' });
  await italian.click();
  await expect(page.locator('#selected-poem')).toContainText('Luce di prova');
  await expect(italian).toHaveAttribute('lang', 'it');
  await page.locator('a.poem-card', { hasText: 'Seara la margine'.normalize('NFD') }).click();
  await expect(page.locator('#selected-poem')).toContainText('Originale in rumeno');
  await expect(page.getByRole('search', { name: 'Cerca nella collezione' })).toBeVisible();
});

test('an Italian poem page shows the Italian version', async ({ page }) => {
  await page.goto('/?lang=it');
  await page.locator('a.poem-card', { hasText: 'L’incontro nel boschetto' }).click();
  await page.locator('.collection-detail-link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('L’incontro nel boschetto');
  await expect(page.locator('.poem-reading-text')).toContainText('ci troviamo senza mappa.');
  await expect(page.locator('.poem-reading-text')).toHaveAttribute('lang', 'it');
  await expect(page.getByLabel('Il tuo nome')).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="it"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'it_IT');
});

test('a poem without an Italian version shows its original with a note', async ({ page }) => {
  await page.goto('/?lang=it&q=kettle');
  await page
    .locator('.collection-titles')
    .getByRole('link', { name: /^The kettle/ })
    .click();
  await page.locator('.collection-detail-link').click();
  await expect(page.getByText('Traduzione non disponibile; viene mostrato l’originale.')).toBeVisible();
});

test('the shop and its legal pages are in Italian', async ({ page }) => {
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1&lang=it`);
  await expect(page.getByRole('button', { name: 'Aggiungi al carrello' })).toBeVisible();
  await page.getByRole('link', { name: 'Acquista ora' }).click();
  await expect(page.getByRole('button', { name: 'Ordine con obbligo di pagamento' })).toBeVisible();
  await page.goto('/termeni?lang=it');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Termini e condizioni di vendita');
  await expect(page.locator('#retur')).toHaveText('Diritto di recesso e resi');
  await expect(page.locator('.shop-withdrawal-form')).toContainText('Con la presente notifico il recesso');
  await page.goto('/confidentialitate?lang=it');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informativa sulla privacy');
  await page.goto('/autor?lang=it');
  await expect(page.getByRole('heading', { name: 'Infanzia e formazione' })).toBeVisible();
});
