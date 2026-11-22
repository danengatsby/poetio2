// Books sold directly on Poetio: settings, quotes from current prices and stock, orders.
import { AppError } from '../lib/access';
import { normalizeBookPrice } from '../lib/book-price';
import { validImageId } from './images';
import type { Database } from './poems';
import {
  BOOK_LANGUAGES,
  DEFAULT_SHOP_SETTINGS,
  MAX_ITEM_QUANTITY,
  NEXT_STATUSES,
  ORDER_LIMITS,
  ORDER_STATUSES,
  amountCents,
  isCurrency,
  paymentMethods,
  priceCents,
  shopReady,
  type OrderStatus,
  type PaymentMethod,
  type ShopSettings,
} from '../lib/shop';

type Row = Record<string, unknown>;

export async function getShopSettings(db: Database): Promise<ShopSettings> {
  const rows = (await db.prepare('SELECT key, value FROM shop_settings').all<{ key: string; value: string }>()).results;
  const saved = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const settings = { ...DEFAULT_SHOP_SETTINGS };
  for (const key of Object.keys(settings) as (keyof ShopSettings)[]) {
    if (saved[key] === undefined) continue;
    const value = saved[key];
    if (typeof settings[key] === 'number') (settings as Row)[key] = Number(value);
    else if (typeof settings[key] === 'boolean') (settings as Row)[key] = value === '1';
    else (settings as Row)[key] = value;
  }
  return settings;
}

export async function saveShopSettings(db: Database, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Setările lipsesc.');
  const data = value as Row;
  const text = (key: keyof ShopSettings, max: number, label: string) => {
    const item = data[key] ?? '';
    if (typeof item !== 'string' || item.trim().length > max)
      throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return item.replace(/\r\n?/g, '\n').trim();
  };
  const days = (key: 'delivery_min_days' | 'delivery_max_days') => {
    const item = Number(data[key]);
    if (!Number.isInteger(item) || item < 0 || item > 60)
      throw new AppError(400, 'Termenul de livrare: între 0 și 60 de zile lucrătoare.');
    return item;
  };
  const shipping = text('shipping_amount', 12, 'Costul livrării').replace(',', '.');
  const normalizedShipping =
    shipping === '' ? '' : /^\d{1,6}(\.\d{1,2})?$/.test(shipping) ? Number(shipping).toFixed(2) : null;
  if (normalizedShipping === null)
    throw new AppError(400, 'Costul livrării trebuie să fie o sumă, de exemplu 15,00 (sau 0 pentru livrare gratuită).');
  const email = text('contact_email', 200, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError(400, 'Adresa de email de contact nu este validă.');
  const iban = text('transfer_iban', 42, 'IBAN').replace(/\s+/g, '').toUpperCase();
  if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) throw new AppError(400, 'IBAN-ul nu pare valid.');
  if (!isCurrency(data.currency)) throw new AppError(400, 'Alege moneda magazinului.');
  const settings: ShopSettings = {
    seller_name: text('seller_name', 160, 'Vânzător'),
    seller_address: text('seller_address', 300, 'Adresa vânzătorului'),
    seller_details: text('seller_details', 1000, 'Datele vânzătorului'),
    contact_email: email,
    contact_phone: text('contact_phone', 40, 'Telefon'),
    currency: data.currency,
    shipping_amount: normalizedShipping,
    delivery_min_days: days('delivery_min_days'),
    delivery_max_days: days('delivery_max_days'),
    cod_enabled: data.cod_enabled === true,
    transfer_enabled: data.transfer_enabled === true,
    transfer_iban: iban,
    transfer_bank: text('transfer_bank', 120, 'Banca'),
    transfer_beneficiary: text('transfer_beneficiary', 160, 'Beneficiar'),
  };
  if (settings.delivery_max_days < settings.delivery_min_days)
    throw new AppError(400, 'Termenul maxim de livrare nu poate fi mai mic decât cel minim.');
  if (settings.transfer_enabled && !settings.transfer_iban)
    throw new AppError(400, 'Pentru plata prin transfer bancar completează IBAN-ul.');
  // One prepared statement per key: the VPS SQLite adapter keeps a single binding per statement.
  await db.batch(
    Object.entries(settings).map(([key, item]) =>
      db
        .prepare(
          'INSERT INTO shop_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        )
        .bind(key, typeof item === 'boolean' ? (item ? '1' : '0') : String(item)),
    ),
  );
  return settings;
}

export type ShopBook = {
  id: string;
  title: string;
  author: string;
  image_id: string | null;
  image_2_id: string | null;
  price_1: string | null;
  price_2: string | null;
  /** The book's revision, so a price saved here cannot overwrite a newer edit. */
  revision: number;
  stock: number | null;
  language: string;
};

const shopBookQuery = `SELECT books.id, books.title, books.author, books.image_id, books.image_2_id,
  books.price_1, books.price_2, books.revision, book_shop.stock, COALESCE(book_shop.language, '') AS language
  FROM books LEFT JOIN book_shop ON book_shop.book_id = books.id`;

export async function listShopBooks(db: Database): Promise<ShopBook[]> {
  return (await db.prepare(`${shopBookQuery} ORDER BY books.created_at DESC, books.id DESC`).all<ShopBook>()).results;
}

async function getShopBook(db: Database, bookId: string) {
  const book = await db.prepare(`${shopBookQuery} WHERE books.id = ?`).bind(bookId).first<ShopBook>();
  if (!book) throw new AppError(404, 'Cartea nu mai există.');
  return book;
}

function coverPrice(amount: unknown, currency: string, cover: number) {
  if (amount === null || (typeof amount === 'string' && !amount.trim())) return null;
  const price = typeof amount === 'string' && normalizeBookPrice(`${amount.trim()} ${currency}`);
  if (!price) throw new AppError(400, `Scrie pentru coperta ${cover} un preț mai mare decât zero, de exemplu 45,50.`);
  return price;
}

export async function getBookShop(db: Database, bookId: string) {
  return (
    (await db
      .prepare('SELECT stock, language FROM book_shop WHERE book_id = ?')
      .bind(bookId)
      .first<{ stock: number | null; language: string }>()) ?? { stock: null, language: '' }
  );
}

export async function saveBookShop(db: Database, bookId: unknown, value: unknown): Promise<ShopBook> {
  if (!validImageId(bookId)) throw new AppError(400, 'Cartea este nevalidă.');
  const data = (value && typeof value === 'object' ? value : {}) as Row;
  const book = await getShopBook(db, bookId);
  const stock =
    data.stock === undefined ? book.stock : data.stock === null || data.stock === '' ? null : Number(data.stock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100000))
    throw new AppError(400, 'Stocul trebuie să fie un număr întreg între 0 și 100000, sau gol (nelimitat).');
  const language = data.language === undefined ? book.language : data.language;
  if (typeof language !== 'string' || (language && !Object.hasOwn(BOOK_LANGUAGES, language)))
    throw new AppError(400, 'Limba cărții nu este în listă.');

  const conflict = () =>
    new AppError(409, 'Datele cărții sau moneda magazinului s-au schimbat. Reîncarcă pagina înainte de a salva.');
  if (
    (data.expected_stock !== undefined && data.expected_stock !== book.stock) ||
    (data.expected_language !== undefined && data.expected_language !== book.language)
  )
    throw conflict();

  const edits = (['price_1', 'price_2'] as const).filter(key => data[key] !== undefined);
  const currency = edits.length ? (await getShopSettings(db)).currency : null;
  if (currency !== null) {
    if (!Number.isInteger(data.revision)) throw new AppError(400, 'Reîncarcă pagina înainte de a salva prețul.');
    if (book.revision !== data.revision) throw conflict();
    if (data.currency !== undefined && data.currency !== currency) throw conflict();
  }

  // Compare the snapshot inside the transaction as a sale or another edit may have just changed it.
  const inventory = db
    .prepare(
      `INSERT INTO book_shop (book_id, stock, language)
     SELECT books.id, ?, ? FROM books LEFT JOIN book_shop ON book_shop.book_id = books.id
     WHERE books.id = ? AND books.revision = ? AND book_shop.stock IS ?
       AND COALESCE(book_shop.language, '') = ?
       AND (? IS NULL OR COALESCE((SELECT value FROM shop_settings WHERE key = 'currency'), ?) = ?)
     ON CONFLICT(book_id) DO UPDATE SET stock = excluded.stock, language = excluded.language`,
    )
    .bind(
      stock,
      language,
      bookId,
      book.revision,
      book.stock,
      book.language,
      currency,
      DEFAULT_SHOP_SETTINGS.currency,
      currency,
    );
  const statements = [inventory];
  if (currency !== null) {
    const prices = edits.map(key => coverPrice(data[key], currency, key === 'price_1' ? 1 : 2));
    // changes() is the affected row count of the inventory statement in this same batch.
    statements.push(
      db
        .prepare(
          `UPDATE books SET ${edits.map(key => `${key} = ?`).join(', ')}, revision = revision + 1, updated_at = ?
       WHERE id = ? AND changes() = 1`,
        )
        .bind(...prices, Date.now(), bookId),
    );
  }
  const [saved] = (await db.batch(statements)) as { meta: { changes: number } }[];
  if (!saved.meta.changes) throw conflict();
  return getShopBook(db, bookId);
}

export type QuoteLine = {
  book_id: string;
  cover: 1 | 2;
  title: string;
  author: string;
  image_id: string | null;
  quantity: number;
  unit_cents: number;
  currency: string;
  stock: number | null;
  problem: '' | 'unavailable' | 'sold_out' | 'too_many';
};
export type Quote = {
  lines: QuoteLine[];
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  ok: boolean;
};

function readItems(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 10)
    throw new AppError(400, 'Coșul este gol sau prea mare.');
  const items = new Map<string, { book_id: string; cover: 1 | 2; quantity: number }>();
  for (const item of value) {
    const data = (item && typeof item === 'object' ? item : {}) as Row;
    const cover = data.cover === 2 ? 2 : data.cover === 1 ? 1 : null;
    const quantity = Number(data.quantity);
    if (
      !validImageId(data.book_id) ||
      !cover ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ITEM_QUANTITY
    )
      throw new AppError(400, 'Un produs din coș este nevalid.');
    const key = `${data.book_id}:${cover}`;
    const previous = items.get(key);
    items.set(key, {
      book_id: data.book_id,
      cover,
      quantity: Math.min(MAX_ITEM_QUANTITY, (previous?.quantity ?? 0) + quantity),
    });
  }
  return [...items.values()];
}

/** Current prices, stock and delivery for a cart; never trusts prices sent by the browser. */
export async function quote(db: Database, value: unknown, settings?: ShopSettings): Promise<Quote> {
  const shop = settings ?? (await getShopSettings(db));
  const items = readItems(value);
  const lines: QuoteLine[] = [];
  const stockUsed = new Map<string, number>();
  for (const item of items) {
    const book = await db
      .prepare(
        `SELECT books.title, books.author, books.image_id, books.image_2_id, books.price_1, books.price_2, book_shop.stock AS stock
         FROM books LEFT JOIN book_shop ON book_shop.book_id = books.id WHERE books.id = ?`,
      )
      .bind(item.book_id)
      .first<Row>();
    const price = priceCents(book ? ((item.cover === 1 ? book.price_1 : book.price_2) as string | null) : null);
    const stock = (book?.stock as number | null | undefined) ?? null;
    const used = (stockUsed.get(item.book_id) ?? 0) + item.quantity;
    stockUsed.set(item.book_id, used);
    lines.push({
      ...item,
      title: (book?.title as string) ?? '',
      author: (book?.author as string) ?? '',
      image_id: ((item.cover === 2 ? book?.image_2_id : book?.image_id) as string | null) ?? null,
      unit_cents: price?.cents ?? 0,
      currency: price?.currency ?? shop.currency,
      stock,
      problem:
        !book || !price || price.currency !== shop.currency
          ? 'unavailable'
          : stock === 0
            ? 'sold_out'
            : stock !== null && used > stock
              ? 'too_many'
              : '',
    });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.unit_cents * line.quantity, 0);
  const shipping = amountCents(shop.shipping_amount) ?? 0;
  return {
    lines,
    currency: shop.currency,
    subtotal_cents: subtotal,
    shipping_cents: shipping,
    total_cents: subtotal + shipping,
    ok: shopReady(shop) && lines.every(line => !line.problem),
  };
}

const HOUR = 3_600_000;
// Phone numbers typed as +40 712 345 678, 0712345678 or 0040712345678 are the same number.
const phoneKey = (phone: string) => phone.replace(/\D/g, '').slice(-9);

/** Refuses an order when its contact details or the whole shop have placed too many recently (ORDER_LIMITS). */
async function checkOrderLimits(
  db: Database,
  customer: { email: string; phone: string },
  settings: ShopSettings,
  now: number,
) {
  const recent = (
    await db
      .prepare('SELECT email, phone, created_at FROM orders WHERE created_at > ?')
      .bind(now - 24 * HOUR)
      .all<{ email: string; phone: string; created_at: number }>()
  ).results;
  const contact = settings.contact_email ? ` sau scrie-ne la ${settings.contact_email}` : '';
  const email = customer.email.toLowerCase(),
    phone = phoneKey(customer.phone);
  const sameContact = recent.filter(order => order.email.toLowerCase() === email || phoneKey(order.phone) === phone);
  if (sameContact.length >= ORDER_LIMITS.perContactPerDay)
    throw new AppError(
      429,
      `Cu acest email sau telefon s-au trimis deja ${sameContact.length} comenzi în ultimele 24 de ore. Pentru o comandă nouă, revino mâine${contact}.`,
    );
  if (
    recent.length >= ORDER_LIMITS.perDay ||
    recent.filter(order => order.created_at > now - HOUR).length >= ORDER_LIMITS.perHour
  )
    throw new AppError(429, `Magazinul primește acum prea multe comenzi. Încearcă din nou peste o oră${contact}.`);
}

const randomKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');

export async function createOrder(db: Database, value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Comanda este goală.');
  const data = value as Row;
  // A field people do not see; bots fill it in.
  if (data.website) throw new AppError(400, 'Comanda nu a putut fi trimisă.');
  const settings = await getShopSettings(db);
  if (!shopReady(settings)) throw new AppError(409, 'Comenzile nu sunt deschise încă.');
  const text = (key: string, label: string, max: number, required = true) => {
    const item = typeof data[key] === 'string' ? (data[key] as string).replace(/\s+/g, ' ').trim() : '';
    if (required && !item) throw new AppError(400, `Completează câmpul „${label}”.`);
    if (item.length > max) throw new AppError(400, `${label}: maximum ${max} de caractere.`);
    return item;
  };
  const customer = {
    name: text('name', 'Nume și prenume', 120),
    email: text('email', 'Email', 200),
    phone: text('phone', 'Telefon', 30),
    address: text('address', 'Adresa', 300),
    city: text('city', 'Localitatea', 100),
    county: text('county', 'Județul', 100),
    postal_code: text('postal_code', 'Cod poștal', 12, false),
    note: typeof data.note === 'string' ? data.note.trim().slice(0, 1000) : '',
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new AppError(400, 'Adresa de email nu este validă.');
  if (!/^\+?[\d\s().-]{6,30}$/.test(customer.phone)) throw new AppError(400, 'Numărul de telefon nu este valid.');
  const method = data.payment_method as PaymentMethod;
  if (!paymentMethods(settings).includes(method)) throw new AppError(400, 'Alege o metodă de plată disponibilă.');
  if (data.accept_terms !== true) throw new AppError(400, 'Pentru a comanda, acceptă termenii și condițiile.');
  await checkOrderLimits(db, customer, settings, Date.now());
  const offer = await quote(db, data.items, settings);
  if (!offer.ok)
    throw new AppError(409, 'Prețul sau stocul unui produs s-a schimbat. Verifică din nou coșul înainte de a comanda.');

  const id = crypto.randomUUID(),
    key = randomKey(),
    now = Date.now();
  const statements = [
    ...offer.lines
      .filter(line => line.stock !== null)
      .map(line =>
        db.prepare('UPDATE book_shop SET stock = stock - ? WHERE book_id = ?').bind(line.quantity, line.book_id),
      ),
    db
      .prepare(
        `INSERT INTO orders (id, number, access_key, status, customer_name, email, phone, address, city, county, postal_code, note,
           payment_method, currency, subtotal_cents, shipping_cents, total_cents, created_at, updated_at)
         SELECT ?, COALESCE(MAX(number), 1000) + 1, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM orders`,
      )
      .bind(
        id,
        key,
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        customer.city,
        customer.county,
        customer.postal_code,
        customer.note,
        method,
        offer.currency,
        offer.subtotal_cents,
        offer.shipping_cents,
        offer.total_cents,
        now,
        now,
      ),
    ...offer.lines.map(line =>
      db
        .prepare(
          'INSERT INTO order_items (order_id, book_id, cover, title, unit_cents, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(id, line.book_id, line.cover, line.title, line.unit_cents, line.quantity),
    ),
  ];
  try {
    await db.batch(statements);
  } catch (error) {
    if (/book_shop_stock_not_negative|CHECK constraint/i.test(String((error as Error)?.message)))
      throw new AppError(409, 'Între timp s-a epuizat stocul unei cărți din coș. Verifică din nou coșul.');
    throw error;
  }
  const order = await db.prepare('SELECT number FROM orders WHERE id = ?').bind(id).first<{ number: number }>();
  return { id, key, number: order!.number };
}

export type Order = {
  id: string;
  number: number;
  status: OrderStatus;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  county: string;
  postal_code: string;
  note: string;
  payment_method: PaymentMethod;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  created_at: number;
  updated_at: number;
  /** The cover's current image, when the book still exists. */
  items: {
    book_id: string;
    cover: number;
    title: string;
    unit_cents: number;
    quantity: number;
    image_id: string | null;
  }[];
};

async function withItems(db: Database, order: Row | null): Promise<Order | null> {
  if (!order) return null;
  const items = (
    await db
      .prepare(
        `SELECT order_items.book_id, order_items.cover, order_items.title, order_items.unit_cents, order_items.quantity,
           CASE order_items.cover WHEN 2 THEN books.image_2_id ELSE books.image_id END AS image_id
         FROM order_items LEFT JOIN books ON books.id = order_items.book_id
         WHERE order_items.order_id = ? ORDER BY order_items.title`,
      )
      .bind(order.id as string)
      .all<Order['items'][number]>()
  ).results;
  const { access_key: _secret, ...rest } = order;
  void _secret;
  return { ...(rest as unknown as Order), items };
}

/** The customer's view of an order, only with the key from their confirmation link. */
export async function getCustomerOrder(db: Database, id: unknown, key: unknown) {
  if (!validImageId(id) || typeof key !== 'string' || !/^[0-9a-f]{48}$/.test(key)) return null;
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Row>();
  if (!order) return null;
  // Compare the whole key in constant time.
  const stored = order.access_key as string;
  let difference = stored.length ^ key.length;
  for (let index = 0; index < key.length; index++) difference |= stored.charCodeAt(index) ^ key.charCodeAt(index);
  return difference ? null : withItems(db, order);
}

export async function listOrders(db: Database, status: unknown, offset: unknown) {
  const filter = ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : null;
  const start = Math.max(0, Math.min(100000, Number(offset) || 0));
  const rows = (
    await db
      .prepare(
        `SELECT * FROM orders ${filter ? 'WHERE status = ?' : ''} ORDER BY created_at DESC, number DESC LIMIT 21 OFFSET ?`,
      )
      .bind(...(filter ? [filter, start] : [start]))
      .all<Row>()
  ).results;
  const counts = Object.fromEntries(ORDER_STATUSES.map(item => [item, 0])) as Record<OrderStatus, number>;
  for (const row of (
    await db
      .prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status')
      .all<{ status: OrderStatus; count: number }>()
  ).results)
    counts[row.status] = row.count;
  const orders = await Promise.all(rows.slice(0, 20).map(row => withItems(db, row)));
  return { orders: orders as Order[], counts, hasMore: rows.length > 20 };
}

export async function updateOrderStatus(db: Database, id: unknown, value: unknown) {
  if (!validImageId(id)) throw new AppError(400, 'Comanda este nevalidă.');
  const data = (value && typeof value === 'object' ? value : {}) as Row;
  const from = data.from as OrderStatus,
    to = data.status as OrderStatus;
  if (!ORDER_STATUSES.includes(from) || !NEXT_STATUSES[from]?.includes(to))
    throw new AppError(400, 'Schimbarea de status nu este permisă.');
  const stamp = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const statements = [
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?').bind(to, stamp, id, from),
  ];
  if (to === 'cancelled')
    // Put the copies back, only if this request is the one that cancelled the order.
    statements.push(
      db
        .prepare(
          `UPDATE book_shop SET stock = stock + (
             SELECT SUM(quantity) FROM order_items WHERE order_id = ? AND order_items.book_id = book_shop.book_id)
           WHERE stock IS NOT NULL
             AND book_id IN (SELECT book_id FROM order_items WHERE order_id = ?)
             AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'cancelled' AND updated_at = ?)`,
        )
        .bind(id, id, id, stamp),
    );
  const [changed] = (await db.batch(statements)) as { meta?: { changes?: number } }[];
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Row>();
  if (!order) throw new AppError(404, 'Comanda nu mai există.');
  // Only the request that moved the order from `from` succeeds; a stale page gets a conflict.
  if (!changed?.meta?.changes || order.status !== to)
    throw new AppError(409, 'Comanda a fost modificată între timp. Reîncarcă lista.');
  return withItems(db, order);
}

export { normalizeBookPrice };
