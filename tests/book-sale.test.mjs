import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { bookCovers, bookSalePath, purchaseOptions, saleCover } = await tsImport('../lib/book-sale.ts', import.meta.url);
const { bookPriceParts, formatBookPrice, normalizeBookPrice } = await tsImport('../lib/book-price.ts', import.meta.url);

test('purchase options keep valid links once each, with the store host', () => {
  assert.deepEqual(purchaseOptions({ purchase_url_1: 'https://www.amazon.com/dp/B0HQJS27M2', purchase_url_2: null }), [
    { cover: 1, url: 'https://www.amazon.com/dp/B0HQJS27M2', host: 'amazon.com', price: null },
  ]);
  assert.deepEqual(
    purchaseOptions({ purchase_url_1: 'https://shop.example/a', purchase_url_2: 'https://shop.example/a' }).length,
    1,
  );
  assert.deepEqual(
    purchaseOptions({ purchase_url_1: 'javascript:alert(1)', purchase_url_2: 'http://carti.example/b' }),
    [{ cover: 2, url: 'http://carti.example/b', host: 'carti.example', price: null }],
  );
  assert.deepEqual(purchaseOptions({ purchase_url_1: '', purchase_url_2: 'relativ/link' }), []);
});

test('the sale page picks the requested cover only when the book has it', () => {
  const both = bookCovers({ image_id: 'a', image_2_id: 'b' }).map(item => item.cover);
  const second = bookCovers({ image_id: null, image_2_id: 'b' }).map(item => item.cover);
  assert.deepEqual(both, [1, 2]);
  assert.equal(saleCover('2', both), 2);
  assert.equal(saleCover('1', second), 2);
  assert.equal(saleCover(['2'], both), 1);
  assert.equal(saleCover(undefined, []), null);
  assert.equal(
    bookSalePath('7d3f5a1e-2b4c-4d6e-8f90-1a2b3c4d5e6f', 2),
    '/carti/7d3f5a1e-2b4c-4d6e-8f90-1a2b3c4d5e6f/cumpara?coperta=2',
  );
});

test("prices are stored as amount and currency and shown in the reader's language", () => {
  assert.equal(normalizeBookPrice('10 USD'), '10.00 USD');
  assert.equal(normalizeBookPrice(' 10,5 eur '), '10.50 EUR');
  assert.equal(normalizeBookPrice(''), null);
  assert.equal(normalizeBookPrice(null), null);
  for (const invalid of ['0 USD', '10.999 USD', '10 JPY', '10', 'zece lei', 42])
    assert.equal(normalizeBookPrice(invalid), undefined, String(invalid));
  assert.equal(formatBookPrice('10.00 USD', 'ro'), '10,00\u00a0USD');
  assert.equal(formatBookPrice('10.00 USD', 'en-US'), '$10.00');
  assert.equal(formatBookPrice('bad', 'ro'), null);
  assert.deepEqual(bookPriceParts('49.90 RON'), { amount: '49.90', currency: 'RON' });
  assert.deepEqual(bookPriceParts(''), { amount: '', currency: 'RON' });
  assert.deepEqual(
    purchaseOptions({ purchase_url_1: 'https://shop.example/a', purchase_url_2: null, price_1: '9,99 EUR' })[0].price,
    '9.99 EUR',
  );
});
