import { expect, test } from './test.mjs';
import { OWNER_EMAIL, fixtureBook } from './fixture.mjs';

const visible = page => page.locator('.book-visible-pages');

for (const [label, viewport] of [
  ['phone', { width: 360, height: 760 }],
  ['desktop', { width: 1440, height: 900 }],
]) {
  test(`${label}: first and last page buttons and keys move to the ends of the book`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/carti/${fixtureBook.record.id}`);
    const nav = page.getByRole('navigation', { name: 'Navigare pagini sus' });
    const first = nav.getByRole('button', { name: 'Prima pagină' });
    const last = nav.getByRole('button', { name: 'Ultima pagină' });
    const input = nav.getByRole('spinbutton', { name: 'Numărul paginii' });
    await expect(first).toBeDisabled();
    await expect(last).toBeEnabled();

    await last.click();
    await expect(input).toHaveValue(String(fixtureBook.pages));
    await expect(last).toBeDisabled();
    await expect(first).toBeEnabled();
    await first.click();
    await expect(input).toHaveValue('1');

    await page.locator('.book-page-viewport').focus();
    await page.keyboard.press('End');
    await expect(input).toHaveValue(String(fixtureBook.pages));
    await page.keyboard.press('Home');
    await expect(input).toHaveValue('1');

    // Nothing in the toolbar overlaps, at either width.
    const overlaps = await nav.evaluate(element => {
      const boxes = [...element.querySelectorAll('button, input, .book-page-total')]
        .filter(item => getComputedStyle(item).display !== 'none')
        .map(item => item.getBoundingClientRect());
      return boxes.flatMap((a, i) =>
        boxes
          .slice(i + 1)
          .filter(
            b => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5,
          ),
      ).length;
    });
    expect(overlaps).toBe(0);
  });
}

test('phone: the page number field turns the page on Enter and when left', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`/carti/${fixtureBook.record.id}`);
  const input = page.getByRole('navigation', { name: 'Navigare pagini sus' }).getByRole('spinbutton');
  await input.fill('5');
  await input.press('Enter');
  await expect(visible(page)).toHaveText(`Pagina 5 din ${fixtureBook.pages}`);
  await input.fill('9');
  await visible(page).click();
  await expect(visible(page)).toHaveText(`Pagina 9 din ${fixtureBook.pages}`);
  await input.fill('99');
  await visible(page).click();
  await expect(input).toHaveValue('9');
});

test('a cover opens the sale page with that cover, details and an order button on Poetio', async ({
  page,
  context,
}) => {
  await page.goto('/carti');
  const cover = page.getByRole('link', { name: `Detalii și cumpărare: ${fixtureBook.record.title} — coperta 2` });
  await expect(cover).toHaveAttribute('href', new RegExp(`/carti/${fixtureBook.record.id}/cumpara\\?coperta=2`));
  await cover.click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixtureBook.record.title);
  await expect(page.getByText('de Autor (Autor)')).toBeVisible();
  const thumbs = page.getByRole('group', { name: 'Alege coperta' });
  await expect(thumbs.getByRole('button', { name: 'Coperta 2' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: `Coperta 2: ${fixtureBook.record.title}` })).toBeVisible();

  // Only cover 1 has a price, so that is the copy sold, on Poetio itself.
  const buy = page.getByRole('link', { name: 'Cumpără acum' });
  await expect(buy).toHaveAttribute(
    'href',
    new RegExp(`^/comanda\\?carte=${fixtureBook.record.id}&coperta=1&cantitate=1&lang=ro$`),
  );
  await expect(page.getByRole('button', { name: 'Adaugă în coș' })).toBeEnabled();
  await expect(page.locator('.book-sale-facts')).toContainText(`${fixtureBook.pages} pagini`);
  await expect(page.locator('.book-sale-facts')).toContainText('Română');
  await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '10,00\u00a0USD');
  await expect(page.getByRole('button', { name: /Carte tipărită\s*10,00/ })).toHaveAttribute('aria-pressed', 'true');
  const offer = await page
    .locator('script[type="application/ld+json"]')
    .evaluate(script => JSON.parse(script.textContent).offers[0]);
  expect(offer).toMatchObject({ price: '10.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' });
  expect(offer.url).toMatch(new RegExp(`/carti/${fixtureBook.record.id}/cumpara\\?coperta=1$`));
  // No link, text or data leads to another store.
  expect(await page.content()).not.toContain('example.com/carte-de-proba');
  const external = await page.$$eval('a[href]', links =>
    links.map(link => link.href).filter(href => new URL(href).origin !== location.origin),
  );
  expect(external).toEqual([]);
  await expect(page.getByRole('link', { name: 'Citește un fragment' })).toHaveAttribute(
    'href',
    new RegExp(`/carti/${fixtureBook.record.id}(\\?|$)`),
  );

  // The long description folds behind "Read more".
  const description = page.locator('#book-sale-description');
  const hidesText = () => description.evaluate(element => element.scrollHeight > element.clientHeight + 1);
  expect(await hidesText()).toBe(true);
  await expect(description).toHaveClass(/is-clamped/);
  await page.getByRole('button', { name: 'Citește mai mult' }).click();
  await expect(page.getByRole('button', { name: 'Citește mai puțin' })).toHaveAttribute('aria-expanded', 'true');
  expect(await hidesText()).toBe(false);
  await expect(description).not.toHaveClass(/is-clamped/);

  // Choosing the other cover updates the address, so a copied link keeps it.
  await thumbs.getByRole('button', { name: 'Coperta 1' }).click();
  await expect(page).toHaveURL(/coperta=1/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copiază linkul' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/carti/${fixtureBook.record.id}/cumpara\\?coperta=1`),
  );
});

test('phone: the sale page shows the title, then the covers and the purchase box, without sideways scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1`);
  const heading = await page.locator('.book-sale-heading').boundingBox();
  const gallery = await page.locator('.book-sale-gallery').boundingBox();
  expect(gallery.y).toBeGreaterThan(heading.y + heading.height - 1);
  const buy = await page.locator('.book-sale-buy').boundingBox();
  const details = await page.locator('.book-sale-details').boundingBox();
  expect(buy.y).toBeGreaterThan(gallery.y + gallery.height - 1);
  expect(details.y).toBeGreaterThan(buy.y + buy.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test.describe('editor', () => {
  test.use({ extraHTTPHeaders: { 'oai-authenticated-user-email': OWNER_EMAIL } });

  test("a price set in the editor puts that cover on sale, in the reader's format", async ({ page }) => {
    await page.goto('/admin/carti');
    await expect(page.locator('#book-price-1')).toHaveValue('10.00');
    // The preview's covers open the saved book's sale page in a new tab.
    await page.getByRole('button', { name: 'Previzualizare ca cititor' }).click();
    const previewCover = page.getByRole('dialog').locator('.book-cover-link').first();
    await expect(previewCover).toHaveAttribute('href', new RegExp(`/carti/${fixtureBook.record.id}/cumpara`));
    await expect(previewCover).toHaveAttribute('target', '_blank');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    // The editor no longer asks for links to other stores.
    await expect(page.getByLabel(/Link de achiziție/)).toHaveCount(0);
    const save = async () => {
      const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.ok());
      await page.getByRole('button', { name: 'Salvează carte' }).click();
      return (await (await saved).json()).book;
    };
    await page.locator('#book-price-2').fill('12,50');
    expect((await save()).price_2).toBe('12.50 USD');

    await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=2`);
    await expect(page.getByRole('button', { name: /Coperta 2\s*12,50/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '12,50\u00a0USD');
    await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=2&lang=en-US`);
    await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '$12.50');

    // A price in another currency than the shop's is kept, but not offered.
    await page.goto('/admin/carti');
    await page.locator('#book-currency-2').selectOption('EUR');
    expect((await save()).price_2).toBe('12.50 EUR');
    await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=2`);
    await expect(page.getByRole('group', { name: 'Variante' }).getByRole('button')).toHaveCount(1);

    // Leave the book as the other tests expect it.
    await page.goto('/admin/carti');
    await page.locator('#book-price-2').fill('');
    expect((await save()).price_2).toBe(null);
  });
});

test('library offers online reading and the priced printed edition under the title', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/carti');
  const card = page.locator('.book-card').filter({ hasText: fixtureBook.record.title });
  await expect(card.locator('p')).toHaveText(fixtureBook.record.description.split('\n')[0]);
  const read = card.getByRole('link', { name: 'Citește online' });
  const buy = card.getByRole('link', { name: /Cumpără cartea tipărită.*10,00.*USD/ });
  await expect(read).toBeInViewport({ ratio: 1 });
  await expect(buy).toBeInViewport({ ratio: 1 });
  await read.click();
  await expect(page).toHaveURL(/#lectura$/);
  await expect(page.locator('#lectura')).toBeInViewport();
  await page.goBack();
  await buy.click();
  await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '10,00\u00a0USD');
});
