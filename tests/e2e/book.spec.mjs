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
