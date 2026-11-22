// Rules for the visit statistics shown in /admin/vizite: what counts as a visit,
// how a browser is described, and how long the IP address is kept.

/** Days after which a visit keeps its page, time and approximate place but loses its IP address and browser string. */
export const VISIT_IP_RETENTION_DAYS = 90;
/** Page views from the same visitor less than this far apart belong to one visit. */
export const VISIT_SESSION_GAP_MS = 30 * 60_000;
/** Most page views recorded for one IP address in an hour; more are ignored. */
export const VISITS_PER_IP_HOUR = 300;
export const VISIT_RANGES = [1, 7, 30, 90] as const;
export type VisitRange = (typeof VISIT_RANGES)[number];
/** Set in a browser's localStorage from /admin/vizite so the owner's own reading is not counted. */
export const VISIT_IGNORE_KEY = 'poetio-vizite-ignora';
export const VISIT_TIME_ZONE = 'Europe/Bucharest';

const BOTS =
  /bot\b|bot\/|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|python|curl|wget|httpclient|okhttp|java\/|go-http|node-fetch|axios|undici|monitor|uptime|pingdom|phantomjs|selenium|puppeteer|playwright|prerender/i;

export function isBot(userAgent: string) {
  // Cubot is a phone brand, not a crawler.
  return !userAgent.trim() || BOTS.test(userAgent.replace(/Cubot/gi, ''));
}

export type BrowserInfo = { device: 'mobil' | 'tabletă' | 'desktop'; browser: string; os: string };

const version = (userAgent: string, pattern: RegExp) => userAgent.match(pattern)?.[1]?.replace(/_/g, '.') ?? '';
const major = (value: string) => value.split('.')[0];

/** A short description of the device, browser and operating system. */
export function describeBrowser(userAgent: string): BrowserInfo {
  const ua = userAgent;
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua);
  const browsers: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\/([\d.]+)/, 'Edge'],
    [/(?:OPR|Opera)\/([\d.]+)/, 'Opera'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/YaBrowser\/([\d.]+)/, 'Yandex'],
    [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
  ];
  let browser = '';
  for (const [pattern, label] of browsers) {
    const found = version(ua, pattern);
    if (found) {
      browser = `${label} ${major(found)}`;
      break;
    }
  }
  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = `Android ${major(version(ua, /Android ([\d.]+)/))}`.trim();
  else if (/iPhone|iPad|iPod/.test(ua))
    os = `iOS ${version(ua, /OS ([\d_]+) like Mac/)
      .split('.')
      .slice(0, 2)
      .join('.')}`.trim();
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { device: tablet ? 'tabletă' : mobile ? 'mobil' : 'desktop', browser, os };
}

/** The visited page without query or fragment; null for pages that are not counted. */
export function visitPath(value: unknown) {
  if (typeof value !== 'string') return null;
  const path = value.split(/[?#]/)[0];
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 300 || /[\s\0]/.test(path)) return null;
  if (/^\/(admin|api|_next|_poetio)(\/|$)/.test(path)) return null;
  return path;
}

/** The site a visitor came from (host name only); empty for direct visits and links inside Poetio. */
export function referrerHost(value: unknown, siteHost: string) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'android-app:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase().slice(0, 120);
    const site = siteHost.toLowerCase().replace(/:\d+$/, '');
    return host === site || host === `www.${site}` ? '' : host;
  } catch {
    return '';
  }
}

const SOURCES: [RegExp, string][] = [
  [/^mail\.google\.com$|^com\.google\.android\.gm$/, 'Gmail'],
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/, 'Google'],
  [/(^|\.)facebook\.com$|^fb\.me$|^com\.facebook\.(katana|orca)$/, 'Facebook'],
  [/(^|\.)instagram\.com$|^com\.instagram\.android$/, 'Instagram'],
  [/(^|\.)whatsapp\.com$|^wa\.me$|^com\.whatsapp$/, 'WhatsApp'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X (Twitter)'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)yahoo\.com$/, 'Yahoo'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, 'ChatGPT'],
];

/** "Google", "Facebook"… for a referrer host; the host itself when unknown; "Intrare directă" when empty. */
export function sourceLabel(host: string) {
  if (!host) return 'Intrare directă';
  return SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

/** The id of the order whose page this is (/comanda/<uuid>), or null. */
export function orderIdOfPath(path: string) {
  return (
    path.match(/^\/comanda\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1].toLowerCase() ??
    null
  );
}

export type PlaceFields = { country: string; region: string; city: string };

/** Country name in Romanian from its ISO code. */
export function countryName(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  try {
    return new Intl.DisplayNames(['ro'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Cluj-Napoca, Cluj County, România" — the parts that are known. */
export function placeLabel(place: PlaceFields) {
  const parts = [place.city, place.region !== place.city ? place.region : '', countryName(place.country)].filter(
    Boolean,
  );
  return parts.length ? parts.join(', ') : 'Necunoscut';
}

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: VISIT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const hourFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: VISIT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Local (Bucharest) day "YYYY-MM-DD", or day and hour "YYYY-MM-DD HH", of a timestamp. */
export function localBucket(time: number, hourly: boolean) {
  if (!hourly) return dayFormat.format(time);
  const parts = Object.fromEntries(hourFormat.formatToParts(time).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}`;
}

export function visitRange(value: unknown): VisitRange {
  const days = Number(value);
  return (VISIT_RANGES as readonly number[]).includes(days) ? (days as VisitRange) : 7;
}
