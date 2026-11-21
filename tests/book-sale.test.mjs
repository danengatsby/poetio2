import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { bookCovers, bookSalePath, saleCover, saleVariants } = await tsImport('../lib/book-sale.ts', import.meta.url);
const { bookPriceParts, formatBookPrice, normalizeBookPrice } = await tsImport('../lib/book-price.ts', import.meta.url);

test('covers with a valid price are the variants sold on Poetio', () => {
  assert.deepEqual(saleVariants({ price_1: '10 USD', price_2: null }), [{ cover: 1, price: '10.00 USD' }]);
  assert.deepEqual(saleVariants({ price_1: '10,5 eur', price_2: '12.00 EUR' }), [
    { cover: 1, price: '10.50 EUR' },
    { cover: 2, price: '12.00 EUR' },
  ]);
  assert.deepEqual(saleVariants({ price_1: 'gratis', price_2: '' }), []);
  assert.deepEqual(saleVariants({}), []);
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
});
