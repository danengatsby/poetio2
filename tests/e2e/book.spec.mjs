import { expect, test } from '@playwright/test';
import { fixtureBook } from './fixture.mjs';

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

test('a cover opens the sale page with that cover, details and the store link', async ({ page, context }) => {
  await page.goto('/carti');
  const cover = page.getByRole('link', { name: `Detalii și cumpărare: ${fixtureBook.record.title} — coperta 2` });
  await expect(cover).toHaveAttribute('href', new RegExp(`/carti/${fixtureBook.record.id}/cumpara\\?coperta=2`));
  await cover.click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixtureBook.record.title);
  await expect(page.getByText('de Autor (Autor)')).toBeVisible();
  const thumbs = page.getByRole('group', { name: 'Alege coperta' });
  await expect(thumbs.getByRole('button', { name: 'Coperta 2' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: `Coperta 2: ${fixtureBook.record.title}` })).toBeVisible();

  const buy = page.getByRole('link', { name: 'Cumpără pe example.com', exact: true });
  await expect(buy).toHaveAttribute('href', fixtureBook.record.purchase_url_1);
  await expect(buy).toHaveAttribute('target', '_blank');
  await expect(buy).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('.book-sale-facts')).toContainText(`${fixtureBook.pages} pagini`);
  await expect(page.locator('.book-sale-facts')).toContainText('example.com');
  await expect(page.getByRole('link', { name: 'Citește un fragment' })).toHaveAttribute(
    'href',
    new RegExp(`/carti/${fixtureBook.record.id}(\\?|$)`),
  );

  // The long description folds behind "Read more".
  const description = page.locator('#book-sale-description');
  const hidesText = () => description.evaluate(element => element.scrollHeight > element.clientHeight + 1);
  expect(await hidesText()).toBe(true);
  await page.getByRole('button', { name: 'Citește mai mult' }).click();
  await expect(page.getByRole('button', { name: 'Citește mai puțin' })).toHaveAttribute('aria-expanded', 'true');
  expect(await hidesText()).toBe(false);

  // Choosing the other cover updates the address, so a copied link keeps it.
  await thumbs.getByRole('button', { name: 'Coperta 1' }).click();
  await expect(page).toHaveURL(/coperta=1/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copiază linkul' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/carti/${fixtureBook.record.id}/cumpara\\?coperta=1`),
  );
});

test('phone: the sale page shows the purchase box right after the covers, without sideways scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=1`);
  const gallery = await page.locator('.book-sale-gallery').boundingBox();
  const buy = await page.locator('.book-sale-buy').boundingBox();
  const details = await page.locator('.book-sale-details').boundingBox();
  expect(buy.y).toBeGreaterThan(gallery.y + gallery.height - 1);
  expect(details.y).toBeGreaterThan(buy.y + buy.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
