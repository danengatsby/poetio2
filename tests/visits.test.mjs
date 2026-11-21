import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsImport } from 'tsx/esm/api';
import { migrate } from '../scripts/migrate.mjs';
import { openDatabase } from '../server/vps-storage.mjs';

const visits = await tsImport('../db/visits.ts', import.meta.url);
const rules = await tsImport('../lib/visits.ts', import.meta.url);

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DAY = 86_400_000;
// 21 Nov 2026, 12:00 in Bucharest.
const NOON = Date.UTC(2026, 10, 21, 10);
const LONDON = { country: 'GB', region: 'England', city: 'London' };

async function store(t) {
  const directory = mkdtempSync(join(tmpdir(), 'poetio-visits-'));
  const file = join(directory, 'poetio.sqlite3');
  await migrate(file, { create: true });
  const db = openDatabase(file);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return db;
}

const visit = (db, overrides = {}) =>
  visits.recordVisit(db, {
    path: '/',
    referrer: '',
    language: 'ro',
    ip: '81.2.69.142',
    userAgent: CHROME,
    siteHost: 'poetio.cloud',
    place: LONDON,
    now: NOON,
    ...overrides,
  });

const rows = db =>
  db
    .prepare('SELECT * FROM visits ORDER BY created_at, id')
    .all()
    .then(result => result.results);

test('describes browsers and recognises robots', () => {
  assert.deepEqual(rules.describeBrowser(CHROME), { device: 'desktop', browser: 'Chrome 131', os: 'Windows' });
  assert.deepEqual(rules.describeBrowser(IPHONE), { device: 'mobil', browser: 'Safari 17', os: 'iOS 17.5' });
  assert.deepEqual(
    rules.describeBrowser(
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ),
    { device: 'tabletă', browser: 'Chrome 130', os: 'Android 14' },
  );
  assert.equal(
    rules.describeBrowser(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    ).browser,
    'Edge 131',
  );
  for (const robot of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1',
    'curl/8.5.0',
    '',
  ])
    assert.equal(rules.isBot(robot), true, robot);
  assert.equal(rules.isBot(CHROME), false);
  assert.equal(rules.isBot('Mozilla/5.0 (Linux; Android 13; Cubot X70) Chrome/120.0 Mobile Safari/537.36'), false);
});

test('keeps only public pages and the host of outside referrers', () => {
  assert.equal(rules.visitPath('/poeme/abc?lang=en-US#top'), '/poeme/abc');
  for (const path of ['/admin', '/admin/vizite', '/api/visits', '//evil.example/x', 'poeme', '/a b', 42])
    assert.equal(rules.visitPath(path), null, String(path));
  assert.equal(rules.referrerHost('https://www.google.com/search?q=poezie', 'poetio.cloud'), 'www.google.com');
  assert.equal(rules.referrerHost('https://poetio.cloud/video', 'poetio.cloud'), '');
  assert.equal(rules.referrerHost('https://www.poetio.cloud/', 'poetio.cloud'), '');
  assert.equal(rules.referrerHost('android-app://com.google.android.gm/', 'poetio.cloud'), 'com.google.android.gm');
  assert.equal(rules.referrerHost('javascript:alert(1)', 'poetio.cloud'), '');
  assert.equal(rules.placeLabel(LONDON), 'London, England, Regatul Unit');
  assert.equal(rules.placeLabel({ country: '', region: '', city: '' }), 'Necunoscut');
  assert.equal(rules.localBucket(Date.UTC(2026, 10, 20, 22, 30), false), '2026-11-21');
  assert.equal(rules.localBucket(Date.UTC(2026, 6, 20, 21, 30), true), '2026-07-21 00');
});

test('groups page views into visits and ignores repeats, robots, admin pages and floods', async t => {
  const db = await store(t);
  assert.equal(await visit(db, { referrer: 'https://www.google.com/search?q=poetio' }), true);
  // The same page reported again within seconds (reload, double report).
  assert.equal(await visit(db, { now: NOON + 3_000 }), false);
  assert.equal(await visit(db, { path: '/video', now: NOON + 60_000 }), true);
  // Another browser from the same address is another visitor.
  assert.equal(await visit(db, { userAgent: IPHONE, now: NOON + 90_000 }), true);
  // After more than 30 minutes the same visitor starts a new visit.
  assert.equal(await visit(db, { path: '/carti', now: NOON + 40 * 60_000 }), true);
  assert.equal(await visit(db, { userAgent: 'curl/8.5.0', now: NOON + 41 * 60_000 }), false);
  assert.equal(await visit(db, { path: '/admin/vizite', now: NOON + 42 * 60_000 }), false);

  const saved = await rows(db);
  assert.equal(saved.length, 4);
  assert.equal(saved[0].session_id, saved[1].session_id);
  assert.notEqual(saved[2].session_id, saved[0].session_id);
  assert.notEqual(saved[3].session_id, saved[0].session_id);
  assert.equal(saved[0].visitor, saved[3].visitor);
  assert.deepEqual(
    [saved[0].ip, saved[0].referrer, saved[0].city, saved[0].device, saved[0].browser, saved[0].language],
    ['81.2.69.142', 'www.google.com', 'London', 'desktop', 'Chrome 131', 'ro'],
  );
  assert.equal(saved[1].referrer, '');
  assert.equal(saved[2].device, 'mobil');

  // At most VISITS_PER_IP_HOUR page views per address and hour.
  const flood = '203.0.113.9';
  const start = NOON + 2 * 3_600_000;
  for (let index = 0; index < rules.VISITS_PER_IP_HOUR; index++)
    assert.equal(await visit(db, { ip: flood, path: `/p${index}`, now: start + index * 11_000 }), true);
  assert.equal(await visit(db, { ip: flood, path: '/over', now: start + 3_400_000 }), false);
});

test('clears IP address and browser string after the retention period, keeping the place', async t => {
  const db = await store(t);
  const old = NOON - (rules.VISIT_IP_RETENTION_DAYS + 1) * DAY;
  await visit(db, { now: old });
  await visit(db, { ip: '198.51.100.7', path: '/video', now: NOON - DAY });
  assert.equal(await visits.forgetOldVisitors(db, NOON), 1);
  const [gone, kept] = await rows(db);
  assert.deepEqual([gone.ip, gone.user_agent, gone.visitor, gone.city], [null, null, gone.session_id, 'London']);
  assert.equal(kept.ip, '198.51.100.7');
  assert.equal(await visits.forgetOldVisitors(db, NOON), 0);
});

test('reports totals, days, pages with titles, places, sources and recent visits', async t => {
  const db = await store(t);
  await db.batch([
    db.prepare(
      "INSERT INTO poems (id, title, author, theme, content, source_language, revision, created_at, updated_at) VALUES ('11111111-2222-4333-8444-555555555555', 'Roata de fum', 'Autor', '', 'Text', 'ro', 1, 1, 1)",
    ),
  ]);
  const poem = '/poeme/11111111-2222-4333-8444-555555555555';
  await visit(db, { now: NOON - 2 * DAY, referrer: 'https://www.facebook.com/' });
  await visit(db, { path: poem, now: NOON - 2 * DAY + 60_000 });
  await visit(db, { ip: '86.120.1.1', place: { country: 'RO', region: 'Prahova', city: 'Ploiești' }, now: NOON - DAY });
  await visit(db, {
    ip: '86.120.1.1',
    path: poem,
    place: { country: 'RO', region: 'Prahova', city: 'Ploiești' },
    now: NOON - DAY + 120_000,
  });
  await visit(db, { ip: '198.51.100.7', userAgent: IPHONE, place: null, now: NOON - 60_000 });
  // Outside the 7-day range.
  await visit(db, { ip: '192.0.2.1', now: NOON - 8 * DAY });

  const stats = await visits.visitStats(db, { days: 7, now: NOON });
  assert.deepEqual(stats.totals, { views: 5, visits: 3, visitors: 3, active: 1 });
  assert.equal(stats.buckets.length, 8);
  assert.equal(stats.buckets.at(-1).key, '2026-11-21');
  assert.deepEqual(
    stats.buckets
      .filter(bucket => bucket.views)
      .map(bucket => [bucket.key, bucket.visitors, bucket.visits, bucket.views]),
    [
      ['2026-11-19', 1, 1, 2],
      ['2026-11-20', 1, 1, 2],
      ['2026-11-21', 1, 1, 1],
    ],
  );
  assert.deepEqual(stats.pages[0], { path: '/', views: 3, visitors: 3 });
  assert.deepEqual(stats.pages[1], { path: poem, views: 2, visitors: 2 });
  assert.equal(stats.titles[poem], 'Roata de fum');
  // Two pages each in London and Ploiești, one page from an unknown place.
  assert.deepEqual(stats.places.map(place => [place.city, place.visitors, place.views]).sort(), [
    ['', 1, 1],
    ['London', 1, 2],
    ['Ploiești', 1, 2],
  ]);
  assert.equal(stats.places.at(-1).city, '');
  assert.deepEqual(stats.sources, [
    { referrer: '', visits: 2 },
    { referrer: 'www.facebook.com', visits: 1 },
  ]);
  assert.equal(stats.sessions.length, 3);
  assert.equal(stats.sessions[0].ip, '198.51.100.7');
  assert.equal(stats.sessions[0].device, 'mobil');
  assert.deepEqual(
    stats.sessions[2].views.map(view => view.path),
    ['/', poem],
  );
  assert.equal(stats.hasMore, false);

  const one = await visits.visitStats(db, { days: 7, ip: '86.120.1.1', now: NOON });
  assert.deepEqual(one.totals, { views: 2, visits: 1, visitors: 1, active: 0 });
  assert.equal(one.sessions[0].city, 'Ploiești');

  const hourly = await visits.visitStats(db, { days: 1, now: NOON });
  assert.equal(hourly.hourly, true);
  assert.equal(hourly.buckets.length, 25);
  assert.equal(hourly.buckets.at(-1).key, '2026-11-21 12');
  assert.deepEqual(
    hourly.buckets.filter(bucket => bucket.views).map(bucket => [bucket.key, bucket.views]),
    [
      ['2026-11-20 12', 2],
      ['2026-11-21 11', 1],
    ],
  );
});
