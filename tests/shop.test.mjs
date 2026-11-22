import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { migrate } from '../scripts/migrate.mjs';
import { openDatabase } from '../server/vps-storage.mjs';

const shop = await tsImport('../db/shop.ts', import.meta.url);
const rules = await tsImport('../lib/shop.ts', import.meta.url);
const BOOK = '7d3f5a1e-2b4c-4d6e-8f90-1a2b3c4d5e6f';
const OTHER = '11111111-2222-4333-8444-555555555555';

async function store(t) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-shop-'));
  const file = join(directory, 'poetio.sqlite3');
  await migrate(file, { create: true });
  const db = openDatabase(file);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await db.batch([
    db.prepare(
      "INSERT INTO book_files (id, object_key, file_name, content_type, byte_size, content_hash, owner_email, created_at) VALUES ('f', 'k', 'n', 'application/pdf', 1, 'h', 'o', 1)",
    ),
    db
      .prepare(
        "INSERT INTO books (id, title, author, description, file_id, price_1, price_2, revision, created_at, updated_at) VALUES (?, 'Europa', 'Autor', '', 'f', '49.90 RON', '59.90 RON', 1, 1, 1)",
      )
      .bind(BOOK),
    db
      .prepare(
        "INSERT INTO books (id, title, author, description, file_id, price_1, revision, created_at, updated_at) VALUES (?, 'Dolari', 'Autor', '', 'f', '10.00 USD', 1, 2, 2)",
      )
      .bind(OTHER),
  ]);
  await shop.saveShopSettings(db, {
    ...rules.DEFAULT_SHOP_SETTINGS,
    seller_name: 'Dan Enache',
    contact_email: 'autor@example.com',
    shipping_amount: '15',
  });
  await shop.saveBookShop(db, BOOK, { stock: 3, language: 'ro' });
  return db;
}

const customer = {
  name: 'Ana Pop',
  email: 'ana@example.com',
  phone: '+40 712 345 678',
  address: 'Str. Florilor 1',
  city: 'Iași',
  county: 'Iași',
  postal_code: '700000',
  payment_method: 'cod',
  accept_terms: true,
};

test('settings are validated, normalized and opened only when complete', async t => {
  const db = await store(t);
  const settings = await shop.getShopSettings(db);
  assert.equal(settings.shipping_amount, '15.00');
  assert.equal(rules.shopReady(settings), true);
  assert.deepEqual(rules.paymentMethods(settings), ['cod']);
  await assert.rejects(shop.saveShopSettings(db, { ...settings, transfer_enabled: true, transfer_iban: '' }), /IBAN/);
  await assert.rejects(shop.saveShopSettings(db, { ...settings, shipping_amount: 'gratis' }), /Costul livrării/);
  await assert.rejects(
    shop.saveShopSettings(db, { ...settings, delivery_min_days: 5, delivery_max_days: 2 }),
    /Termenul maxim/,
  );
  assert.equal(rules.shopReady({ ...settings, seller_name: '' }), false);
});

test('a quote uses stored prices and stock, not what the browser sends', async t => {
  const db = await store(t);
  const offer = await shop.quote(db, [
    { book_id: BOOK, cover: 1, quantity: 2, unit_cents: 1 },
    { book_id: BOOK, cover: 2, quantity: 1 },
  ]);
  assert.deepEqual(
    offer.lines.map(line => [line.cover, line.unit_cents, line.problem]),
    [
      [1, 4990, ''],
      [2, 5990, ''],
    ],
  );
  assert.equal(offer.subtotal_cents, 2 * 4990 + 5990);
  assert.equal(offer.shipping_cents, 1500);
  assert.equal(offer.total_cents, 2 * 4990 + 5990 + 1500);
  assert.equal(offer.ok, true);
  // Both covers draw on the same three copies.
  assert.equal(
    (
      await shop.quote(db, [
        { book_id: BOOK, cover: 1, quantity: 2 },
        { book_id: BOOK, cover: 2, quantity: 2 },
      ])
    ).lines[1].problem,
    'too_many',
  );
  // A price in another currency than the shop's cannot be ordered.
  assert.equal((await shop.quote(db, [{ book_id: OTHER, cover: 1, quantity: 1 }])).lines[0].problem, 'unavailable');
  await assert.rejects(shop.quote(db, [{ book_id: BOOK, cover: 3, quantity: 1 }]), /nevalid/);
  await assert.rejects(shop.quote(db, []), /gol/);
});

test('an order takes a number, totals from the database and decrements the stock', async t => {
  const db = await store(t);
  const first = await shop.createOrder(db, { ...customer, items: [{ book_id: BOOK, cover: 1, quantity: 2 }] });
  assert.equal(first.number, 1001);
  assert.match(first.key, /^[0-9a-f]{48}$/);
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 1);
  const order = await shop.getCustomerOrder(db, first.id, first.key);
  assert.equal(order.total_cents, 2 * 4990 + 1500);
  assert.equal(order.items[0].title, 'Europa');
  assert.equal(order.access_key, undefined);
  assert.equal(await shop.getCustomerOrder(db, first.id, 'a'.repeat(48)), null);

  // Two copies are no longer available: refused, nothing written.
  await assert.rejects(shop.createOrder(db, { ...customer, items: [{ book_id: BOOK, cover: 2, quantity: 2 }] }), {
    status: 409,
  });
  assert.equal((await shop.listOrders(db, 'all', 0)).orders.length, 1);
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 1);
  const second = await shop.createOrder(db, { ...customer, items: [{ book_id: BOOK, cover: 2, quantity: 1 }] });
  assert.equal(second.number, 1002);
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 0);
  assert.equal((await shop.quote(db, [{ book_id: BOOK, cover: 1, quantity: 1 }])).lines[0].problem, 'sold_out');
});

test('orders refuse incomplete details, bots and unavailable payment methods', async t => {
  const db = await store(t);
  const items = [{ book_id: BOOK, cover: 1, quantity: 1 }];
  await assert.rejects(shop.createOrder(db, { ...customer, items, phone: 'abc' }), /telefon/);
  await assert.rejects(shop.createOrder(db, { ...customer, items, email: 'nu' }), /email/);
  await assert.rejects(shop.createOrder(db, { ...customer, items, accept_terms: false }), /termenii/);
  await assert.rejects(shop.createOrder(db, { ...customer, items, payment_method: 'transfer' }), /metodă de plată/);
  await assert.rejects(shop.createOrder(db, { ...customer, items, website: 'http://spam' }), /nu a putut/);
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 3);
});

test('orders are limited per email or phone and for the whole shop', async t => {
  const db = await store(t);
  await shop.saveBookShop(db, BOOK, { stock: null, language: 'ro' });
  const items = [{ book_id: BOOK, cover: 1, quantity: 1 }];
  const { perContactPerDay, perHour, perDay } = rules.ORDER_LIMITS;
  for (let i = 0; i < perContactPerDay; i++) await shop.createOrder(db, { ...customer, items });
  // The same email in other letters, or the same phone written differently, is the same contact.
  await assert.rejects(shop.createOrder(db, { ...customer, items, email: 'ANA@example.com', phone: '0799 000 000' }), {
    status: 429,
    message: /ultimele 24 de ore.*autor@example\.com/,
  });
  await assert.rejects(shop.createOrder(db, { ...customer, items, email: 'alt@example.com', phone: '0040712345678' }), {
    status: 429,
  });
  // A refused order writes nothing.
  assert.equal((await shop.listOrders(db, 'all', 0)).orders.length, perContactPerDay);
  // Orders older than 24 hours no longer count.
  await db
    .prepare('UPDATE orders SET created_at = created_at - ?')
    .bind(25 * 3_600_000)
    .run();
  await shop.createOrder(db, { ...customer, items });

  // The shop as a whole: so many orders an hour, and so many in 24 hours.
  const fill = async (count, age) => {
    for (let i = 0; i < count; i++)
      await db
        .prepare(
          `INSERT INTO orders (id, number, access_key, customer_name, email, phone, address, city, county, postal_code,
             payment_method, currency, subtotal_cents, shipping_cents, total_cents, created_at, updated_at)
           SELECT ?, MAX(number) + 1, 'k', 'X', ?, ?, 'a', 'c', 'j', '', 'cod', 'RON', 1, 0, 1, ?, ?  FROM orders`,
        )
        .bind(
          crypto.randomUUID(),
          `x${i}-${age}@example.com`,
          `07${String(age).padStart(3, '0')}${String(i).padStart(5, '0')}`,
          Date.now() - age,
          Date.now() - age,
        )
        .run();
  };
  const other = { ...customer, email: 'nou@example.com', phone: '0733 111 222', items };
  await fill(perHour - 1, 60_000);
  await assert.rejects(shop.createOrder(db, other), { status: 429, message: /prea multe comenzi/ });
  await db
    .prepare('UPDATE orders SET created_at = created_at - ? WHERE created_at > ?')
    .bind(2 * 3_600_000, Date.now() - 3_600_000)
    .run();
  await shop.createOrder(db, other);
  await fill(perDay - perHour - 1, 3 * 3_600_000);
  await assert.rejects(shop.createOrder(db, { ...other, email: 'al-treilea@example.com', phone: '0744 333 444' }), {
    status: 429,
    message: /prea multe comenzi/,
  });
});

test('the per-address limit counts only recent events and forgets old keys', async () => {
  const limit = (await tsImport('../lib/rate-limit.ts', import.meta.url)).createRateLimit(2, 1000, 3);
  limit.record('1.1.1.1', 0);
  limit.record('1.1.1.1', 500);
  assert.equal(limit.allows('1.1.1.1', 900), false);
  assert.equal(limit.allows('1.1.1.1', 1200), true);
  assert.equal(limit.allows('2.2.2.2', 900), true);
  // Without an address (a request that did not come through nginx) nothing is limited.
  limit.record('', 900);
  assert.equal(limit.allows('', 900), true);
  for (const key of ['a', 'b', 'c']) limit.record(key, 1000);
  assert.equal(limit.allows('1.1.1.1', 1100), true);
});

test('status changes follow the order flow and a cancellation returns the copies once', async t => {
  const db = await store(t);
  const order = await shop.createOrder(db, { ...customer, items: [{ book_id: BOOK, cover: 1, quantity: 2 }] });
  await assert.rejects(shop.updateOrderStatus(db, order.id, { from: 'new', status: 'delivered' }), /nu este permisă/);
  assert.equal((await shop.updateOrderStatus(db, order.id, { from: 'new', status: 'confirmed' })).status, 'confirmed');
  assert.equal(
    (await shop.updateOrderStatus(db, order.id, { from: 'confirmed', status: 'cancelled' })).status,
    'cancelled',
  );
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 3);
  // A repeated cancellation from a stale page changes nothing.
  await assert.rejects(shop.updateOrderStatus(db, order.id, { from: 'confirmed', status: 'cancelled' }), {
    status: 409,
  });
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 3);
  const page = await shop.listOrders(db, 'cancelled', 0);
  assert.equal(page.counts.cancelled, 1);
  assert.equal(page.orders[0].number, 1001);
});

test('delivery estimates count working days', () => {
  // Friday 20 November 2026, 10:00 in Bucharest: Monday is the first working day after it.
  const friday = new Date('2026-11-20T08:00:00Z');
  assert.equal(
    rules.deliveryWindow(friday, { delivery_min_days: 2, delivery_max_days: 4 }, 'ro'),
    'marți, 24 noiembrie – joi, 26 noiembrie',
  );
  assert.equal(rules.formatMoney(4990, 'RON', 'ro'), '49,90 RON');
});

test('prices set on the shop page use its currency, need the current revision and keep the history', async t => {
  const db = await store(t);
  // OTHER is priced in USD; the shop sells in RON.
  assert.equal((await shop.quote(db, [{ book_id: OTHER, cover: 1, quantity: 1 }])).lines[0].problem, 'unavailable');
  const saved = await shop.saveBookShop(db, OTHER, { revision: 1, stock: null, language: '', price_1: '45,5' });
  assert.equal(saved.price_1, '45.50 RON');
  assert.equal(saved.price_2, null);
  assert.equal(saved.revision, 2);
  assert.equal((await shop.quote(db, [{ book_id: OTHER, cover: 1, quantity: 1 }])).lines[0].unit_cents, 4550);

  // A page loaded before another edit cannot overwrite it, and then changes nothing at all.
  await assert.rejects(shop.saveBookShop(db, OTHER, { revision: 1, stock: 5, language: '', price_1: '50' }), {
    status: 409,
  });
  assert.equal((await shop.getBookShop(db, OTHER)).stock, null);
  for (const amount of ['0', 'gratis', '1.234,50'])
    await assert.rejects(
      shop.saveBookShop(db, OTHER, { revision: 2, stock: null, language: '', price_2: amount }),
      /coperta 2/,
      amount,
    );

  const cleared = await shop.saveBookShop(db, OTHER, { revision: 2, stock: null, language: '', price_1: '' });
  assert.equal(cleared.price_1, null);
  // Stock and language alone leave the book's revision as it is.
  assert.equal((await shop.saveBookShop(db, OTHER, { stock: 2, language: 'ro' })).revision, 3);
  const history = (
    await db
      .prepare("SELECT revision, snapshot FROM content_history WHERE kind = 'book' AND entity_id = ? ORDER BY revision")
      .bind(OTHER)
      .all()
  ).results.map(row => [row.revision, JSON.parse(row.snapshot).price_1]);
  assert.deepEqual(history.slice(-2), [
    [2, '45.50 RON'],
    [3, null],
  ]);
});

test('a sale preserves its stock decrement when the owner edits a price from an open page', async t => {
  const db = await store(t);
  await shop.createOrder(db, { ...customer, items: [{ book_id: BOOK, cover: 1, quantity: 1 }] });
  const edit = { revision: 1, price_1: '48', currency: 'RON' };
  await assert.rejects(shop.saveBookShop(db, BOOK, { ...edit, stock: 5, expected_stock: 3 }), { status: 409 });
  await assert.rejects(shop.saveBookShop(db, BOOK, { ...edit, currency: 'USD' }), { status: 409 });
  const saved = await shop.saveBookShop(db, BOOK, edit);
  assert.equal(saved.price_1, '48.00 RON');
  assert.equal(saved.stock, 2);
  assert.equal(saved.language, 'ro');
});

test('a failed price update rolls back the inventory edit', async t => {
  const db = await store(t);
  await db
    .prepare(
      "CREATE TRIGGER reject_price BEFORE UPDATE OF price_1 ON books BEGIN SELECT RAISE(ABORT, 'price failed'); END",
    )
    .run();
  await assert.rejects(shop.saveBookShop(db, BOOK, { revision: 1, price_1: '48', stock: 5 }), /price failed/);
  assert.equal((await shop.getBookShop(db, BOOK)).stock, 3);
});

test('the seller address is saved and missing legal details are listed without closing the shop', async t => {
  const db = await store(t);
  let settings = await shop.getShopSettings(db);
  assert.equal(settings.seller_address, '');
  assert.equal(rules.shopReady(settings), true);
  assert.deepEqual(rules.legalGaps(settings), ['adresa vânzătorului', 'telefonul de contact']);
  await shop.saveShopSettings(db, {
    ...settings,
    seller_address: ' Str. Lungă 2\r\nIași ',
    contact_phone: '0700 000 000',
  });
  settings = await shop.getShopSettings(db);
  assert.equal(settings.seller_address, 'Str. Lungă 2\nIași');
  assert.equal(rules.addressLine(settings.seller_address), 'Str. Lungă 2, Iași');
  assert.deepEqual(rules.legalGaps(settings), []);
  await assert.rejects(shop.saveShopSettings(db, { ...settings, seller_address: 'x'.repeat(301) }), /maximum 300/);
});
