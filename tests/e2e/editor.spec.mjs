import { readFileSync } from 'node:fs';
import { expect, test } from './test.mjs';
import { OWNER_EMAIL } from './fixture.mjs';

// The app trusts this header; on the VPS only nginx sets it, after Basic Auth.
test.use({ extraHTTPHeaders: { 'oai-authenticated-user-email': OWNER_EMAIL } });

const image = {
  name: 'rain.webp',
  mimeType: 'image/webp',
  buffer: readFileSync(new URL('../../public/assets/poem-rain.webp', import.meta.url)),
};

test('a recovered draft keeps the image uploaded before the save failed', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/admin');
  await page.getByRole('button', { name: /The kettle and the rain/ }).click();
  const title = page.getByRole('textbox', { name: 'Titlu — English (US)' });
  await expect(title).toHaveValue('The kettle and the rain');

  await title.fill('The kettle, the rain and a picture');
  await page.locator('#poem-image').setInputFiles(image);

  // The image upload succeeds; the poem save itself fails once.
  const uploaded = page.waitForResponse(response => response.url().endsWith('/api/images') && response.ok());
  await page.route('**/api/poems/*', route =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test outage"}' })
      : route.fallback(),
  );
  await page.getByRole('button', { name: 'Salvează modificările' }).click();
  const imageId = (await (await uploaded).json()).image.id;
  await expect(page.getByText('Test outage')).toBeVisible();
  await page.unroute('**/api/poems/*');

  await page.reload();
  await page.getByText('Recuperează schițe și versiuni').click();
  const local = page.locator('li').filter({ hasText: 'The kettle, the rain and a picture' });
  await local.getByRole('button', { name: 'Previzualizează' }).click();
  await page.getByRole('button', { name: 'Încarcă în editor, fără publicare' }).click();
  await expect(title).toHaveValue('The kettle, the rain and a picture');

  const saved = page.waitForRequest(
    request => request.method() === 'PUT' && /\/api\/poems\/[^/]+$/.test(request.url()),
  );
  await page.getByRole('button', { name: 'Salvează modificările' }).click();
  const body = (await saved).postDataJSON();
  expect(body.title).toBe('The kettle, the rain and a picture');
  expect(body.image_id).toBe(imageId);
});
