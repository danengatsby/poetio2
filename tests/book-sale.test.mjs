import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { bookCovers, bookSalePath, purchaseOptions, saleCover } = await tsImport('../lib/book-sale.ts', import.meta.url);

test('purchase options keep valid links once each, with the store host', () => {
  assert.deepEqual(purchaseOptions({ purchase_url_1: 'https://www.amazon.com/dp/B0HQJS27M2', purchase_url_2: null }), [
    { cover: 1, url: 'https://www.amazon.com/dp/B0HQJS27M2', host: 'amazon.com' },
  ]);
  assert.deepEqual(
    purchaseOptions({ purchase_url_1: 'https://shop.example/a', purchase_url_2: 'https://shop.example/a' }).length,
    1,
  );
  assert.deepEqual(
    purchaseOptions({ purchase_url_1: 'javascript:alert(1)', purchase_url_2: 'http://carti.example/b' }),
    [{ cover: 2, url: 'http://carti.example/b', host: 'carti.example' }],
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
