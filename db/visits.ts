// Page views of the public site and the statistics shown in /admin/vizite.
import type { Database } from './poems';
import { isSiteLanguage } from '../lib/site-language';
import type { OrderStatus } from '../lib/shop';
import {
  VISIT_CLEANUP_SQL,
  VISIT_IP_RETENTION_DAYS,
  VISIT_SESSION_GAP_MS,
  VISITS_PER_IP_HOUR,
  describeBrowser,
  isBot,
  localBucket,
  orderIdOfPath,
  referrerHost,
  visitPath,
  type PlaceFields,
  type VisitRange,
} from '../lib/visits';

type Row = Record<string, unknown>;

export type VisitInput = {
  path: unknown;
  referrer: unknown;
  language: unknown;
  ip: string;
  userAgent: string;
  /** Host of this site, so links inside Poetio are not counted as a source. */
  siteHost: string;
  place: PlaceFields | null;
  now?: number;
};

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).subarray(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
}

let lastCleanup = 0;

/** Clears the IP address and browser string of visits older than the retention period. */
export async function forgetOldVisitors(db: Database, now = Date.now()) {
  const before = now - VISIT_IP_RETENTION_DAYS * 86_400_000;
  const result = await db.prepare(VISIT_CLEANUP_SQL).bind(before).run();
  lastCleanup = now;
  return result.meta.changes;
}

/** Records one page view. Returns false when it is not counted (bot, duplicate, limit, invalid page). */
export async function recordVisit(db: Database, input: VisitInput) {
  const now = input.now ?? Date.now();
  const path = visitPath(input.path);
  const userAgent = input.userAgent.slice(0, 400);
  if (!path || isBot(userAgent)) return false;
  if (now - lastCleanup > 3_600_000) await forgetOldVisitors(db, now);

  const ip = input.ip.slice(0, 64);
  if (ip) {
    const recent = await db
      .prepare('SELECT COUNT(*) AS count FROM visits WHERE ip = ? AND created_at > ?')
      .bind(ip, now - 3_600_000)
      .first<{ count: number }>();
    if ((recent?.count ?? 0) >= VISITS_PER_IP_HOUR) return false;
  }

  const visitor = await sha256(`${ip}\n${userAgent}`);
  const last = await db
    .prepare('SELECT session_id, path, created_at FROM visits WHERE visitor = ? ORDER BY created_at DESC LIMIT 1')
    .bind(visitor)
    .first<{ session_id: string; path: string; created_at: number }>();
  const continues = last && now - last.created_at < VISIT_SESSION_GAP_MS;
  // A reload, or the same page reported twice, is one view.
  if (continues && last.path === path && now - last.created_at < 10_000) return false;
  const session = continues ? last.session_id : crypto.randomUUID();
  const browser = describeBrowser(userAgent);
  const language = isSiteLanguage(input.language) ? input.language : '';
  await db
    .prepare(
      `INSERT INTO visits (created_at, session_id, visitor, ip, user_agent, path, referrer, language, country, region, city, device, browser, os)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      now,
      session,
      visitor,
      ip || null,
      userAgent,
      path,
      referrerHost(input.referrer, input.siteHost),
      language,
      input.place?.country.slice(0, 2) ?? '',
      input.place?.region.slice(0, 120) ?? '',
      input.place?.city.slice(0, 120) ?? '',
      browser.device,
      browser.browser,
      browser.os,
    )
    .run();
  return true;
}

export type VisitView = { at: number; path: string };
/** An order whose page was opened during a visit. */
export type VisitOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  created_at: number;
  /** Placed during this visit; false when the visitor came back later to look at it. */
  placed: boolean;
};
export type VisitSession = PlaceFields & {
  id: string;
  started: number;
  ended: number;
  ip: string | null;
  device: string;
  browser: string;
  os: string;
  referrer: string;
  language: string;
  views: VisitView[];
  orders: VisitOrder[];
};
export type VisitBucket = { key: string; visitors: number; visits: number; views: number };
export type VisitStats = {
  days: VisitRange;
  ip: string | null;
  since: number;
  until: number;
  hourly: boolean;
  totals: { views: number; visits: number; visitors: number; active: number };
  buckets: VisitBucket[];
  pages: { path: string; views: number; visitors: number }[];
  places: (PlaceFields & { visitors: number; views: number })[];
  countries: { country: string; visitors: number }[];
  sources: { referrer: string; visits: number }[];
  devices: { device: string; visitors: number }[];
  sessions: VisitSession[];
  hasMore: boolean;
  /** Titles of the poems, films and books among the pages listed. */
  titles: Record<string, string>;
};

const SESSIONS_PER_PAGE = 30;

/** Statistics for the last `days` days (24 hours for 1), optionally for one IP address. */
export async function visitStats(
  db: Database,
  options: { days: VisitRange; ip?: string | null; offset?: number; now?: number },
): Promise<VisitStats> {
  const now = options.now ?? Date.now();
  const since = now - options.days * 86_400_000;
  const ip = options.ip ? options.ip.slice(0, 64) : null;
  const offset = Math.max(0, Math.min(100_000, Math.floor(options.offset ?? 0)));
  const where = `created_at >= ? AND created_at <= ?${ip ? ' AND ip = ?' : ''}`;
  const args: (string | number)[] = ip ? [since, now, ip] : [since, now];
  const query = <T>(sql: string, ...extra: (string | number)[]) =>
    db
      .prepare(sql)
      .bind(...args, ...extra)
      .all<T>()
      .then(result => result.results);

  const hourly = options.days === 1;
  const rows = await query<{ created_at: number; session_id: string; visitor: string }>(
    `SELECT created_at, session_id, visitor FROM visits WHERE ${where}`,
  );
  // Every bucket in the range, so days without visits show as zero.
  const keys: string[] = [];
  for (let time = since; time <= now + 3_600_000; time += 3_600_000) {
    const key = localBucket(Math.min(time, now), hourly);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  const groups = new Map(keys.map(key => [key, { views: 0, visitors: new Set<string>(), visits: new Set<string>() }]));
  const bucketOf = new Map<number, string>();
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  for (const row of rows) {
    const hour = Math.floor(row.created_at / 3_600_000);
    let key = bucketOf.get(hour);
    if (!key) bucketOf.set(hour, (key = localBucket(row.created_at, hourly)));
    const group = groups.get(key);
    if (group) {
      group.views++;
      group.visitors.add(row.visitor);
      group.visits.add(row.session_id);
    }
    visitors.add(row.visitor);
    sessions.add(row.session_id);
  }
  const active = new Set(rows.filter(row => row.created_at > now - 5 * 60_000).map(row => row.visitor)).size;

  const [pages, places, countries, sources, devices, sessionPage] = await Promise.all([
    query<{ path: string; views: number; visitors: number }>(
      `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors FROM visits WHERE ${where}
       GROUP BY path ORDER BY views DESC, path LIMIT 15`,
    ),
    query<PlaceFields & { visitors: number; views: number }>(
      `SELECT country, region, city, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views FROM visits WHERE ${where}
       GROUP BY country, region, city ORDER BY visitors DESC, views DESC LIMIT 15`,
    ),
    query<{ country: string; visitors: number }>(
      `SELECT country, COUNT(DISTINCT visitor) AS visitors FROM visits WHERE ${where}
       GROUP BY country ORDER BY visitors DESC LIMIT 10`,
    ),
    // Where each visit started.
    query<{ referrer: string; visits: number }>(
      `SELECT referrer, COUNT(*) AS visits FROM (
         SELECT session_id, referrer FROM visits AS v WHERE ${where}
           AND created_at = (SELECT MIN(created_at) FROM visits WHERE session_id = v.session_id)
       ) GROUP BY referrer ORDER BY visits DESC LIMIT 10`,
    ),
    query<{ device: string; visitors: number }>(
      `SELECT device, COUNT(DISTINCT visitor) AS visitors FROM visits WHERE ${where}
       GROUP BY device ORDER BY visitors DESC`,
    ),
    query<{ session_id: string; last: number }>(
      `SELECT session_id, MAX(created_at) AS last FROM visits WHERE ${where}
       GROUP BY session_id ORDER BY last DESC LIMIT ? OFFSET ?`,
      SESSIONS_PER_PAGE + 1,
      offset,
    ),
  ]);

  const ids = sessionPage.slice(0, SESSIONS_PER_PAGE).map(row => row.session_id);
  const viewRows = ids.length
    ? (
        await db
          .prepare(
            `SELECT * FROM visits WHERE session_id IN (${ids.map(() => '?').join(', ')}) ORDER BY created_at, id`,
          )
          .bind(...ids)
          .all<Row>()
      ).results
    : [];
  const bySession = new Map<string, VisitSession>();
  for (const row of viewRows) {
    const id = row.session_id as string;
    let session = bySession.get(id);
    if (!session) {
      session = {
        id,
        started: row.created_at as number,
        ended: row.created_at as number,
        ip: (row.ip as string | null) ?? null,
        country: row.country as string,
        region: row.region as string,
        city: row.city as string,
        device: row.device as string,
        browser: row.browser as string,
        os: row.os as string,
        referrer: row.referrer as string,
        language: row.language as string,
        views: [],
        orders: [],
      };
      bySession.set(id, session);
    }
    session.ended = row.created_at as number;
    session.views.push({ at: row.created_at as number, path: row.path as string });
  }

  const listed = [...new Set([...pages.map(page => page.path), ...viewRows.map(row => row.path as string)])];
  // After placing an order the buyer lands on its page, /comanda/<id>: that ties the order to the visit.
  const orders = await ordersOfPages(db, listed);
  for (const session of bySession.values()) {
    for (const view of session.views) {
      const id = orderIdOfPath(view.path);
      const order = id ? orders.get(id) : undefined;
      if (!order || session.orders.some(known => known.id === order.id)) continue;
      // Allows a minute for a buyer whose checkout page view was not reported.
      const placed = order.created_at >= session.started - 60_000 && order.created_at <= view.at;
      session.orders.push({ ...order, placed });
    }
  }
  const titles = await pageTitles(db, listed);
  for (const [id, order] of orders) titles[`/comanda/${id}`] = `nr. ${order.number}`;
  return {
    days: options.days,
    ip,
    since,
    until: now,
    hourly,
    totals: { views: rows.length, visits: sessions.size, visitors: visitors.size, active },
    buckets: keys.map(key => {
      const group = groups.get(key)!;
      return { key, views: group.views, visitors: group.visitors.size, visits: group.visits.size };
    }),
    pages,
    places,
    countries,
    sources,
    devices,
    sessions: ids.map(id => bySession.get(id)!).filter(Boolean),
    hasMore: sessionPage.length > SESSIONS_PER_PAGE,
    titles,
  };
}

async function ordersOfPages(db: Database, paths: string[]) {
  const ids = [...new Set(paths.map(orderIdOfPath).filter((id): id is string => id !== null))];
  if (!ids.length) return new Map<string, Omit<VisitOrder, 'placed'>>();
  const rows = (
    await db
      .prepare(
        `SELECT id, number, status, total_cents, currency, created_at FROM orders WHERE id IN (${ids.map(() => '?').join(', ')})`,
      )
      .bind(...ids)
      .all<Omit<VisitOrder, 'placed'>>()
  ).results;
  return new Map(rows.map(row => [row.id, row]));
}

const CONTENT = [
  ['poeme', 'poems'],
  ['video', 'videos'],
  ['carti', 'books'],
] as const;

async function pageTitles(db: Database, paths: string[]) {
  const titles: Record<string, string> = {};
  for (const [segment, table] of CONTENT) {
    const ids = new Map<string, string[]>();
    for (const path of paths) {
      // UUIDs, and the ids of the original sample poems (original-1).
      const id = path.match(new RegExp(`^/${segment}/([A-Za-z0-9-]{1,64})(?:/|$)`))?.[1];
      if (id) ids.set(id, [...(ids.get(id) ?? []), path]);
    }
    if (!ids.size) continue;
    const rows = (
      await db
        .prepare(`SELECT id, title FROM ${table} WHERE id IN (${[...ids.keys()].map(() => '?').join(', ')})`)
        .bind(...ids.keys())
        .all<{ id: string; title: string }>()
    ).results;
    for (const row of rows) for (const path of ids.get(row.id) ?? []) titles[path] = row.title;
  }
  return titles;
}
