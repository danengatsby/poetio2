// The site in French: the selector, the interface, poems with and without a French version, and the shop texts.
import { expect, test } from './test.mjs';
import { fixtureBook } from './fixture.mjs';

test('the language selector switches the collection to French and remembers it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await page.getByRole('radio', { name: 'Français' }).first().click();
  await expect(page).toHaveURL(/lang=fr/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('radio', { name: 'Français' }).first()).toHaveAttribute('aria-checked', 'true');
  // A poem with a French version is shown in French; one without is marked as the original.
  const french = page.locator('a.poem-card', { hasText: 'La rencontre au bosquet' });
  await french.click();
  await expect(page.locator('#selected-poem')).toContainText('Lumière d’essai');
  await expect(french).toHaveAttribute('lang', 'fr');
  await page.locator('a.poem-card', { hasText: 'Seara la margine'.normalize('NFD') }).click();
  await expect(page.locator('#selected-poem')).toContainText('Original en roumain');
  await expect(page.getByRole('search', { name: 'Rechercher dans la collection' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Rechercher dans les titres et les textes' })).toBeVisible();
  // The choice is kept without the parameter.
  const cookies = await page.context().cookies();
  expect(cookies.find(cookie => cookie.name === 'poetio-language')?.value).toBe('fr');
  await page.goto('/carti');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('a French poem page shows the French version, its metadata and French comments', async ({ page }) => {
  await page.goto('/?lang=fr');
  await page.locator('a.poem-card', { hasText: 'La rencontre au bosquet' }).click();
  await page.locator('.collection-detail-link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('La rencontre au bosquet');
  await expect(page.locator('.poem-reading-text')).toContainText('nous nous trouvons sans carte.');
  await expect(page.locator('.poem-reading-text')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('link', { name: '← Retour à la collection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /commentaire/ })).toBeVisible();
  await expect(page.getByLabel('Votre nom')).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'fr_FR');
  // The same poem in English and Romanian is unchanged.
  await page.goto(page.url().replace('lang=fr', 'lang=en-US'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The meeting in the grove');
});

test('a poem without a French version shows its original with a note', async ({ page }) => {
  // English original without a French version (tests/e2e/editor.spec.mjs may have renamed it).
  await page.goto('/?lang=fr&q=kettle');
  await page.locator('.collection-detail-link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^The kettle/);
  await expect(page.getByText('Traduction indisponible ; voici l’original.')).toBeVisible();
  await expect(page.locator('.poem-reading-text')).toHaveAttribute('lang', 'en-US');
});

test('the shop and its legal pages are in French', async ({ page }) => {
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1&lang=fr`);
  await expect(page.getByRole('button', { name: 'Ajouter au panier' })).toBeVisible();
  await expect(page.getByText('Vendu par')).toBeVisible();
  await page.getByRole('link', { name: 'Acheter maintenant' }).click();
  await expect(page.getByRole('button', { name: 'Commande avec obligation de paiement' })).toBeVisible();
  await page.goto('/termeni?lang=fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conditions générales de vente');
  await expect(page.locator('#retur')).toHaveText('Droit de rétractation et retours');
  await expect(page.locator('#formular-retragere')).toHaveText('Formulaire de rétractation');
  await expect(page.locator('.shop-withdrawal-form')).toContainText('Je vous notifie par la présente ma rétractation');
  await page.goto('/confidentialitate?lang=fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Politique de confidentialité');
  await expect(page.locator('#vizite')).toContainText('supprimées après 90 jours');
  await page.goto('/autor?lang=fr');
  await expect(page.getByRole('heading', { name: 'Enfance et formation' })).toBeVisible();
});
