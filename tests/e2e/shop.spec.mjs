// Poetio's own shop: the sale page, the cart, checkout, the order page and the owner's order list.
// The tests run in order and share one database: the book starts with 3 copies.
import { expect, test } from './test.mjs';
import { OWNER_EMAIL, fixtureBook, fixtureShop } from './fixture.mjs';

const salePath = `/carti/${fixtureBook.record.id}/cumpara?coperta=1`;
// Matches the text with any kind of space (prices use no-break spaces).
const nbsp = text => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
const cartCount = page => page.locator('.shop-cart-count');

async function fillAddress(page) {
  await page.getByLabel('Nume și prenume').fill('Ana Cititoare');
  await page.getByLabel('Telefon').fill('0722 123 456');
  await page.getByLabel('Email').fill('ana@example.com');
  await page.getByLabel(/^Adresa/).fill('Str. Teilor 5, bl. A, ap. 3');
  await page.getByLabel('Localitatea').fill('Brașov');
  await page.getByLabel('Județul / sectorul').fill('Brașov');
}

test('the sale page sells the book on Poetio: price, delivery, stock and quantity', async ({ page }) => {
  await page.goto(salePath);
  const box = page.getByRole('complementary', { name: 'Cumpărare' });
  await expect(box.locator('.book-sale-amount')).toHaveAttribute('aria-label', '10,00 USD');
  await expect(box).toContainText(nbsp('+ 5,00 USD livrare'));
  await expect(box).toContainText(/Livrare estimată: \S+, \d+ \S+ – \S+, \d+ \S+/);
  await expect(box.locator('.shop-stock')).toHaveText('Doar 3 exemplare în stoc');
  await expect(box.getByLabel('Cantitate:').locator('option')).toHaveCount(3);
  await expect(box).toContainText(`Vândut de${fixtureShop.seller_name}`);
  await expect(box).toContainText('Ramburs (plătești la livrare) · Transfer bancar');
  await expect(cartCount(page)).toHaveText('0');
});

test('a changed delivery price requires the buyer to accept the new quote', async ({ page, request, baseURL }) => {
  const headers = { 'oai-authenticated-user-email': OWNER_EMAIL, Origin: baseURL };
  await page.goto(salePath);
  await page.getByRole('link', { name: 'Cumpără acum' }).click();
  await fillAddress(page);
  await page.getByLabel(/Am citit și accept/).check();
  try {
    expect(
      (await request.put('/api/admin/shop', { headers, data: { ...fixtureShop, shipping_amount: '7.00' } })).ok(),
    ).toBe(true);
    await page.getByRole('button', { name: 'Comandă cu obligație de plată' }).click();
    await expect(page.getByLabel(/Am citit și accept/)).not.toBeChecked();
    await expect(page.getByRole('complementary', { name: 'Sumarul comenzii' })).toContainText(nbsp('17,00 USD'));
    await expect(page.getByText(/Totalul afișat anterior/)).toContainText(nbsp('15,00 USD'));
    await expect(page.getByLabel('Nume și prenume')).toHaveValue('Ana Cititoare');
  } finally {
    expect((await request.put('/api/admin/shop', { headers, data: fixtureShop })).ok()).toBe(true);
  }
});
test('cart and checkout: an order paid by bank transfer', async ({ page }) => {
  await page.goto(salePath);
  await page.getByLabel('Cantitate:').selectOption('2');
  await page.getByRole('button', { name: 'Adaugă în coș' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Adăugat în coș.' })).toBeVisible();
  await expect(cartCount(page)).toHaveText('2');

  await page.getByRole('link', { name: 'Vezi coșul' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coșul de cumpărături (2)');
  const summary = page.getByRole('complementary', { name: 'Sumar' });
  await expect(summary).toContainText(nbsp('Produse (2 cărți)20,00 USD'));
  await expect(summary).toContainText(nbsp('Livrare5,00 USD'));
  await expect(summary).toContainText(nbsp('Total25,00 USD'));
  await page.getByLabel('Cantitate:').selectOption('1');
  await expect(summary).toContainText(nbsp('Total15,00 USD'));

  await page.getByRole('link', { name: 'Finalizează comanda' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Finalizează comanda');
  await fillAddress(page);
  await page.getByLabel(/^Transfer bancar/).check();
  // The terms must be accepted first.
  await page.getByRole('button', { name: 'Comandă cu obligație de plată' }).click();
  await expect(page).toHaveURL(/\/comanda(\?|$)/);
  await page.getByLabel(/Am citit și accept/).check();
  await page.getByRole('button', { name: 'Comandă cu obligație de plată' }).click();

  await expect(page).toHaveURL(/\/comanda\/[0-9a-f-]{36}\?cheie=[0-9a-f]{48}/);
  await expect(page.getByRole('status').first()).toHaveText('Mulțumim! Comanda nr. 1001 a fost înregistrată.');
  const payment = page.getByRole('region', { name: 'Plata prin transfer bancar' });
  await expect(payment).toContainText('RO49 AAAA 1B31 0075 9384 0000');
  await expect(payment).toContainText(nbsp('15,00 USD'));
  await expect(payment).toContainText('Comanda 1001');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // The cart was emptied by the order.
  await expect(cartCount(page)).toHaveText('0');

  // Without the key from the link the order is not shown.
  const url = new URL(page.url());
  expect((await page.request.get(url.pathname + '?cheie=' + '0'.repeat(48))).status()).toBe(404);
});

test('buy now orders one book with cash on delivery and leaves the cart alone', async ({ page }) => {
  await page.goto(salePath);
  await page.getByRole('button', { name: 'Adaugă în coș' }).click();
  await expect(cartCount(page)).toHaveText('1');
  await expect(page.locator('.shop-stock')).toHaveText('Doar 2 exemplare în stoc');

  await page.getByRole('link', { name: 'Cumpără acum' }).click();
  await expect(page).toHaveURL(/\/comanda\?carte=.+&coperta=1&cantitate=1/);
  await expect(page.getByRole('link', { name: 'Modifică coșul' })).toHaveCount(0);
  await fillAddress(page);
  await expect(page.getByLabel(/^Ramburs/)).toBeChecked();
  await page.getByLabel(/Am citit și accept/).check();
  // The server commits but the confirmation is lost. Reloading must find the same receipt.
  await page.route('**/api/orders', async route => {
    if (route.request().postDataJSON().action === 'receipt') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.abort();
  });
  await page.getByRole('button', { name: 'Comandă cu obligație de plată' }).click();
  await expect(page.locator('.shop-alert').filter({ hasText: /fetch|network/i })).toBeVisible();
  await page.reload({ waitUntil: 'commit' });

  await expect(page.getByRole('status').first()).toHaveText('Mulțumim! Comanda nr. 1002 a fost înregistrată.');
  await expect(page.getByText(nbsp('Plătești 15,00 USD curierului, când primești coletul.'))).toBeVisible();
  await expect(cartCount(page)).toHaveText('1');

  await page.goto(salePath);
  await expect(page.locator('.shop-stock')).toHaveText('Doar 1 exemplar în stoc');
  // The cart now asks for more copies than are left; checkout waits for a fix.
  await page.getByRole('button', { name: 'Adaugă în coș' }).click();
  await page.goto('/cos');
  await expect(page.getByText('Doar 1 în stoc. Micșorează cantitatea.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finalizează comanda' })).toBeDisabled();
  await page.getByRole('button', { name: /^Șterge/ }).click();
  await expect(page.getByText('Coșul tău este gol.')).toBeVisible();
});

test('phone: cart, checkout and order pages fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto(salePath);
  await page.getByRole('button', { name: 'Adaugă în coș' }).click();
  for (const path of [salePath, '/cos', '/comanda', '/termeni']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      path,
    ).toBeLessThanOrEqual(0);
  }
  await page.goto('/cos');
  await page.getByRole('button', { name: /^Șterge/ }).click();
});

test('the terms name the seller, the 14-day withdrawal with its form, the guarantee and disputes', async ({ page }) => {
  await page.goto('/termeni');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Termeni și condiții de vânzare');
  await expect(page.locator('#retur')).toHaveText('Dreptul de retragere și returul');
  const main = page.locator('main');
  await expect(page.getByText(`vândute și expediate de ${fixtureShop.seller_name}`)).toBeVisible();
  await expect(main).toContainText('Adresa: Str. Probei 1, Iași');
  await expect(main).toContainText(`Email: ${fixtureShop.contact_email}`);
  await expect(main).toContainText(`Telefon: ${fixtureShop.contact_phone}`);
  await expect(main).toContainText('Poți renunța la cumpărare în 14 zile');
  await expect(page.locator('#formular-retragere')).toHaveText('Formularul de retragere');
  await expect(page.locator('.shop-withdrawal-form')).toContainText(
    `Către: ${fixtureShop.seller_name}, Str. Probei 1, Iași, ${fixtureShop.contact_email}`,
  );
  const mail = page.getByRole('link', { name: 'Trimite formularul prin email' });
  await expect(mail).toHaveAttribute('href', new RegExp(`^mailto:${fixtureShop.contact_email}\\?subject=Retragere`));
  await expect(page.locator('#garantie')).toHaveText('Garanția legală de conformitate');
  await expect(main).toContainText('timp de 2 ani de la livrare');
  await expect(page.getByRole('link', { name: 'anpc.ro/ce-este-sal' })).toHaveAttribute(
    'href',
    'https://anpc.ro/ce-este-sal/',
  );

  // The privacy notice, linked from the terms and from every footer.
  await page.getByRole('link', { name: 'nota de confidențialitate' }).click();
  await expect(page).toHaveURL(/\/confidentialitate/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nota de confidențialitate');
  await expect(page.locator('main')).toContainText(
    `Operatorul datelor este ${fixtureShop.seller_name}, Str. Probei 1, Iași.`,
  );
  await expect(page.locator('#vizite')).toContainText('se șterg după 90 de zile');
  await page.goto('/?lang=en-US');
  await expect(page.locator('footer').getByRole('link', { name: 'Privacy' })).toHaveAttribute(
    'href',
    '/confidentialitate?lang=en-US',
  );
});

test.describe('owner', () => {
  test.use({ extraHTTPHeaders: { 'oai-authenticated-user-email': OWNER_EMAIL } });

  test('the owner confirms and ships one order and cancels the other; the copy returns to stock', async ({ page }) => {
    await page.goto('/admin/comenzi');
    await expect(page.getByRole('button', { name: 'Noi (2)' })).toHaveAttribute('aria-pressed', 'true');
    const second = page.getByRole('article', { name: 'Comanda nr. 1002' });
    await expect(second).toContainText('Ana Cititoare');
    await expect(second).toContainText('1 × Carte de probă');
    await second.getByRole('button', { name: 'Confirmă comanda' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Comanda nr. 1002: confirmată.' })).toBeVisible();

    await page.getByRole('button', { name: /^Confirmate/ }).click();
    await page
      .getByRole('article', { name: 'Comanda nr. 1002' })
      .getByRole('button', { name: 'Marchează expediată' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: 'expediată' })).toBeVisible();

    await page.getByRole('button', { name: /^Noi/ }).click();
    await page.getByRole('article', { name: 'Comanda nr. 1001' }).getByRole('button', { name: 'Anulează' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anulează comanda' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'exemplarele au revenit în stoc' })).toBeVisible();

    await page.goto(salePath);
    await expect(page.locator('.shop-stock')).toHaveText('Doar 2 exemplare în stoc');
  });

  test('the shop page saves stock; at 0 the book shows as sold out', async ({ page }) => {
    await page.goto('/admin/magazin');
    await expect(page.getByText('Magazinul este deschis')).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: fixtureBook.record.title });
    await expect(row.getByLabel('Stoc')).toHaveValue('2');
    await row.getByLabel('Stoc').fill('0');
    await row.getByRole('button', { name: 'Salvează' }).click();
    await expect(row.getByText('Salvat.')).toBeVisible();
    await expect(page.getByText('Stoc epuizat pentru toate cărțile cu preț.', { exact: false })).toBeVisible();

    await page.goto(salePath);
    await expect(page.locator('.shop-stock')).toHaveText('Stoc epuizat');
    await expect(page.getByRole('button', { name: 'Adaugă în coș' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cumpără acum' })).toBeDisabled();

    await page.goto('/admin/magazin');
    await row.getByLabel('Stoc').fill('');
    await row.getByRole('button', { name: 'Salvează' }).click();
    await expect(row.getByText('Salvat.')).toBeVisible();
    await page.goto(salePath);
    await expect(page.locator('.shop-stock')).toHaveText('În stoc');
  });

  test('prices set on the shop page put covers on sale or take them off', async ({ page }) => {
    await page.goto('/admin/magazin');
    const row = page.getByRole('listitem').filter({ hasText: fixtureBook.record.title });
    await expect(row).toContainText('Se vinde pe Poetio: coperta 1 – 10,00\u00a0USD');
    await expect(row.getByLabel('Preț coperta 1 (USD)')).toHaveValue('10,00');
    // Another tab records a stock count while the owner has the price form open.
    const inventory = await page.context().newPage();
    await inventory.goto('/admin/magazin');
    const inventoryRow = inventory.getByRole('listitem').filter({ hasText: fixtureBook.record.title });
    await inventoryRow.getByLabel('Stoc').fill('4');
    await inventoryRow.getByRole('button', { name: 'Salvează' }).click();
    await expect(inventoryRow.getByText('Salvat.')).toBeVisible();
    await inventory.close();

    await row.getByLabel('Preț coperta 2 (USD)').fill('12,50');
    await row.getByRole('button', { name: 'Salvează' }).click();
    await expect(row.getByText('Salvat.')).toBeVisible();
    await expect(row).toContainText('coperta 2 – 12,50\u00a0USD');
    await expect(row.getByLabel('Stoc')).toHaveValue('4');

    await page.goto(`/carti/${fixtureBook.record.id}/cumpara?coperta=2`);
    await expect(page.getByRole('group', { name: 'Variante' }).getByRole('button')).toHaveCount(2);
    await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '12,50\u00a0USD');

    // Without any price nothing can be ordered, and the page says so.
    await page.goto('/admin/magazin');
    await row.getByLabel('Preț coperta 1 (USD)').fill('');
    await row.getByLabel('Preț coperta 2 (USD)').fill('');
    await row.getByRole('button', { name: 'Salvează' }).click();
    await expect(row.getByText('Salvat.')).toBeVisible();
    await expect(page.getByText('nicio carte nu are preț în USD')).toBeVisible();
    await expect(row).toContainText('Nu se vinde încă');
    await page.goto(salePath);
    await expect(page.getByText('Cartea nu este încă de vânzare.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adaugă în coș' })).toHaveCount(0);

    // Put the price back as the other tests expect it.
    await page.goto('/admin/magazin');
    await row.getByLabel('Preț coperta 1 (USD)').fill('10');
    await row.getByLabel('Stoc').fill('');
    await row.getByRole('button', { name: 'Salvează' }).click();
    await expect(row.getByText('Salvat.')).toBeVisible();
    await expect(page.getByText('Magazinul este deschis: o carte se poate comanda.')).toBeVisible();
    await page.goto(salePath);
    await expect(page.locator('.book-sale-amount')).toHaveAttribute('aria-label', '10,00\u00a0USD');
  });
});
