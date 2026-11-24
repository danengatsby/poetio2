// The site in Spanish: the selector, the interface, poems with and without a Spanish version, and the shop texts.
import { expect, openSelectedPoemPage, test } from './test.mjs';
import { fixtureBook } from './fixture.mjs';

test('the language selector switches the collection to Spanish', async ({ page }) => {
  await page.goto('/?' + new URLSearchParams({ theme: 'Lumină de probă' }));
  await page.getByRole('radio', { name: 'Español' }).first().click();
  await expect(page).toHaveURL(/lang=es/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  const spanish = page.locator('a.poem-card', { hasText: 'El encuentro en la arboleda' });
  await spanish.click();
  await expect(page.locator('#selected-poem')).toContainText('Luz de prueba');
  await expect(spanish).toHaveAttribute('lang', 'es');
  await page.locator('a.poem-card', { hasText: 'Seara la margine'.normalize('NFD') }).click();
  await expect(page.locator('#selected-poem')).toContainText('Original en rumano');
  await expect(page.getByRole('search', { name: 'Buscar en la colección' })).toBeVisible();
});

test('a Spanish poem page shows the Spanish version', async ({ page }) => {
  await page.goto('/?lang=es');
  await page.locator('a.poem-card', { hasText: 'El encuentro en la arboleda' }).click();
  await openSelectedPoemPage(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('El encuentro en la arboleda');
  await expect(page.locator('.poem-reading-text')).toContainText('nos encontramos sin mapa.');
  await expect(page.locator('.poem-reading-text')).toHaveAttribute('lang', 'es');
  await expect(page.getByLabel('Tu nombre')).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'es_ES');
});

test('a poem without a Spanish version shows its original with a note', async ({ page }) => {
  await page.goto('/?lang=es&q=kettle');
  await page
    .locator('.collection-titles')
    .getByRole('link', { name: /^The kettle/ })
    .click();
  await openSelectedPoemPage(page);
  await expect(page.getByText('Traducción no disponible; se muestra el original.')).toBeVisible();
});

test('the shop and its legal pages are in Spanish', async ({ page }) => {
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1&lang=es`);
  await expect(page.getByRole('button', { name: 'Añadir al carrito' })).toBeVisible();
  await page.getByRole('link', { name: 'Comprar ahora' }).click();
  await expect(page.getByRole('button', { name: 'Pedido con obligación de pago' })).toBeVisible();
  await page.goto('/termeni?lang=es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Términos y condiciones de venta');
  await expect(page.locator('#retur')).toHaveText('Derecho de desistimiento y devoluciones');
  await expect(page.locator('.shop-withdrawal-form')).toContainText('Por la presente le comunico que desisto');
  await page.goto('/confidentialitate?lang=es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad');
  await page.goto('/autor?lang=es');
  await expect(page.getByRole('heading', { name: 'Infancia y formación' })).toBeVisible();
});
