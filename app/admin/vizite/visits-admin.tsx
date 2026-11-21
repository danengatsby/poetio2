'use client';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { VisitBucket, VisitSession, VisitStats } from '@/db/visits';
import {
  VISIT_IGNORE_KEY,
  VISIT_IP_RETENTION_DAYS,
  VISIT_RANGES,
  VISIT_TIME_ZONE,
  countryName,
  placeLabel,
  type VisitRange,
} from '@/lib/visits';
import ShopAdminFrame from '../shop-admin-frame';
import './visits-admin.css';

type Stats = VisitStats & { geo: { type: string; built: number } | null };

const RANGE_LABEL: Record<VisitRange, string> = { 1: '24 de ore', 7: '7 zile', 30: '30 de zile', 90: '90 de zile' };
const PAGE_LABEL: Record<string, string> = {
  '/': 'Prima pagină',
  '/video': 'Video',
  '/carti': 'Cărți',
  '/autor': 'Autorul',
  '/cos': 'Coșul de cumpărături',
  '/comanda': 'Finalizarea comenzii',
  '/termeni': 'Termeni și condiții',
  '/subtitrari': 'Subtitrări',
};
const DEVICE_LABEL: Record<string, string> = { mobil: 'Telefon', tabletă: 'Tabletă', desktop: 'Calculator' };

const number = (value: number) => new Intl.NumberFormat('ro').format(value);
const time = (value: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ro', { timeZone: VISIT_TIME_ZONE, ...options }).format(value);
// Romanian: 1 vizită, 2–19 vizite, 20 de vizite (and 100, 120…), but 0 vizite.
const plural = (count: number, one: string, many: string) =>
  `${number(count)} ${count === 1 ? one : count % 100 >= 20 || (count > 0 && count % 100 === 0) ? `de ${many}` : many}`;

function pageLabel(path: string, titles: Record<string, string>) {
  const title = titles[path];
  if (title) {
    if (path.startsWith('/poeme/')) return `Poem: ${title}`;
    if (path.startsWith('/video/')) return `Film: ${title}`;
    if (path.endsWith('/cumpara')) return `Cumpără: ${title}`;
    if (path.startsWith('/carti/')) return `Carte: ${title}`;
  }
  if (PAGE_LABEL[path]) return PAGE_LABEL[path];
  if (path.startsWith('/comanda/')) return 'Pagina unei comenzi';
  return path;
}

function bucketLabel(key: string, hourly: boolean, long = false) {
  if (hourly) return `${key.slice(11, 13)}:00`;
  const date = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat('ro', {
    timeZone: 'UTC',
    ...(long ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: long ? 'long' : 'short',
  }).format(date);
}

/** Axis ticks at a clean step (1, 2 or 5 times a power of ten), at most five of them. */
function axisTicks(value: number) {
  if (value <= 4) return [0, 1, 2, 3, 4];
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find(factor => factor * power * 4 >= value)! * power;
  const top = Math.ceil(value / step) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

function VisitorChart({ buckets, hourly }: { buckets: VisitBucket[]; hourly: boolean }) {
  const peak = Math.max(0, ...buckets.map(bucket => bucket.visitors));
  const ticks = axisTicks(peak);
  const top = ticks[ticks.length - 1];
  const peakIndex = peak ? buckets.findIndex(bucket => bucket.visitors === peak) : -1;
  // Up to 8 dates under the columns, and only 3 of them on a phone.
  const every = buckets.length <= 8 ? 1 : Math.ceil(buckets.length / 7);
  const sparse = Math.max(1, Math.ceil((buckets.length - 1) / 2));
  const labelled = (index: number) => index % every === 0 || index === buckets.length - 1;
  const onPhone = (index: number) => index % sparse === 0 || index === buckets.length - 1;
  const title = hourly ? 'Vizitatori pe oră' : 'Vizitatori pe zi';
  return (
    <section className="visits-chart" aria-labelledby="visits-chart-title">
      <h2 id="visits-chart-title">{title}</h2>
      <div className="visits-plot">
        <div className="visits-grid" aria-hidden="true">
          {ticks.map(tick => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              <em>{number(tick)}</em>
            </span>
          ))}
        </div>
        <ol className="visits-columns">
          {buckets.map((bucket, index) => (
            <li key={bucket.key}>
              <button
                type="button"
                className="visits-column"
                aria-label={`${bucketLabel(bucket.key, hourly, true)}: ${plural(bucket.visitors, 'vizitator', 'vizitatori')}, ${plural(bucket.visits, 'vizită', 'vizite')}, ${plural(bucket.views, 'pagină', 'pagini')}`}
              >
                <span className="visits-bar" style={{ height: `${(bucket.visitors / top) * 100}%` }}>
                  {index === peakIndex && <span className="visits-peak">{number(peak)}</span>}
                </span>
                <span className="visits-tooltip" role="presentation">
                  <strong>{plural(bucket.visitors, 'vizitator', 'vizitatori')}</strong>
                  <span>
                    {plural(bucket.visits, 'vizită', 'vizite')} · {plural(bucket.views, 'pagină', 'pagini')}
                  </span>
                  <span>{bucketLabel(bucket.key, hourly, true)}</span>
                </span>
              </button>
              {labelled(index) && (
                <span className={onPhone(index) ? 'visits-x' : 'visits-x visits-x-minor'} aria-hidden="true">
                  {bucketLabel(bucket.key, hourly)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <details className="visits-table">
        <summary>Vezi cifrele în tabel</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{hourly ? 'Ora' : 'Ziua'}</th>
              <th scope="col">Vizitatori</th>
              <th scope="col">Vizite</th>
              <th scope="col">Pagini</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map(bucket => (
              <tr key={bucket.key}>
                <th scope="row">{bucketLabel(bucket.key, hourly, true)}</th>
                <td>{number(bucket.visitors)}</td>
                <td>{number(bucket.visits)}</td>
                <td>{number(bucket.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function Ranking({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { key: string; label: ReactNode; value: number; detail?: string }[];
}) {
  const most = Math.max(1, ...rows.map(row => row.value));
  return (
    <section className="visits-ranking">
      <h2>{title}</h2>
      {rows.length ? (
        <ol>
          {rows.map(row => (
            <li key={row.key}>
              <span className="visits-ranking-label">{row.label}</span>
              <span className="visits-ranking-value">
                {number(row.value)}
                {row.detail && <small>{row.detail}</small>}
              </span>
              <span
                className="visits-ranking-bar"
                style={{ width: `${(row.value / most) * 100}%` }}
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="shop-admin-empty">{empty}</p>
      )}
    </section>
  );
}

function SessionCard({
  session,
  titles,
  until,
  onIp,
}: {
  session: VisitSession;
  titles: Record<string, string>;
  /** When the statistics were read, to tell a cleared IP from one never known. */
  until: number;
  onIp: (ip: string) => void;
}) {
  const minutes = Math.round((session.ended - session.started) / 60_000);
  const details = [
    DEVICE_LABEL[session.device] ?? session.device,
    session.browser,
    session.os,
    session.language === 'en-US' ? 'site în engleză' : session.language === 'ro' ? 'site în română' : '',
  ].filter(Boolean);
  return (
    <li className="shop-admin-card visits-session">
      <div className="visits-session-top">
        <time dateTime={new Date(session.started).toISOString()}>
          {time(session.started, { dateStyle: 'medium', timeStyle: 'short' })}
        </time>
        {session.ip ? (
          <button
            type="button"
            className="visits-ip"
            onClick={() => onIp(session.ip!)}
            title="Toate vizitele acestui IP"
          >
            {session.ip}
          </button>
        ) : (
          <span className="visits-ip-gone">
            {session.started < until - VISIT_IP_RETENTION_DAYS * 86_400_000
              ? `IP șters (după ${VISIT_IP_RETENTION_DAYS} de zile)`
              : 'IP necunoscut'}
          </span>
        )}
        <span className="visits-place">{placeLabel(session)}</span>
      </div>
      <p className="visits-session-meta">
        {details.join(' · ')}
        {' · '}
        {session.referrer ? `venit de pe ${session.referrer}` : 'intrare directă'}
      </p>
      <details>
        <summary>
          {plural(session.views.length, 'pagină', 'pagini')}
          {minutes > 0 ? `, ${plural(minutes, 'minut', 'minute')}` : ''}
        </summary>
        <ol className="visits-pages">
          {session.views.map(view => (
            <li key={`${view.at}-${view.path}`}>
              <time dateTime={new Date(view.at).toISOString()}>{time(view.at, { timeStyle: 'short' })}</time>{' '}
              <a href={view.path} target="_blank" rel="noreferrer">
                {pageLabel(view.path, titles)}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

const ignoreListeners = new Set<() => void>();
function subscribeIgnored(listener: () => void) {
  ignoreListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    ignoreListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function readIgnored() {
  try {
    return localStorage.getItem(VISIT_IGNORE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function VisitsAdmin() {
  const [days, setDays] = useState<VisitRange>(7);
  const [ip, setIp] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const ignored = useSyncExternalStore(subscribeIgnored, readIgnored, () => false);

  /** Another period, another IP filter, or the same view again. */
  function show(next: { days?: VisitRange; ip?: string | null }) {
    setLoading(true);
    setError('');
    if (next.days !== undefined) setDays(next.days);
    if (next.ip !== undefined) setIp(next.ip);
    setReload(value => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams({ zile: String(days), ...(ip ? { ip } : {}) });
    fetch(`/api/admin/visits?${search}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Statistica nu poate fi încărcată. Încearcă din nou.');
        setStats(result);
        setError('');
      })
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, ip, reload]);

  async function loadMore() {
    if (!stats) return;
    setMore(true);
    try {
      const search = new URLSearchParams({
        zile: String(days),
        offset: String(stats.sessions.length),
        ...(ip ? { ip } : {}),
      });
      const response = await fetch(`/api/admin/visits?${search}`, { cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Vizitele mai vechi nu pot fi încărcate.');
      setStats(
        current =>
          current && {
            ...current,
            sessions: [...current.sessions, ...result.sessions],
            hasMore: result.hasMore,
            titles: { ...current.titles, ...result.titles },
          },
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setMore(false);
    }
  }

  function toggleIgnored(value: boolean) {
    try {
      if (value) localStorage.setItem(VISIT_IGNORE_KEY, '1');
      else localStorage.removeItem(VISIT_IGNORE_KEY);
      ignoreListeners.forEach(listener => listener());
    } catch {
      setError('Browserul nu permite salvarea acestei preferințe.');
    }
  }

  const totals = stats?.totals;
  return (
    <ShopAdminFrame current="/admin/vizite" skip="Mergi la statistica vizitelor">
      <div className="visits-admin">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Cine citește Poetio</p>
            <h1>Vizite</h1>
            <p>Paginile deschise de vizitatori, cu adresa IP și localitatea aproximativă.</p>
          </div>
        </div>

        <div className="shop-admin-filters" role="group" aria-label="Perioada">
          {VISIT_RANGES.map(range => (
            <button
              key={range}
              type="button"
              className="secondary-button"
              aria-pressed={days === range}
              disabled={loading}
              onClick={() => show({ days: range })}
            >
              {RANGE_LABEL[range]}
            </button>
          ))}
          <button type="button" className="secondary-button" disabled={loading} onClick={() => show({})}>
            Reîncarcă
          </button>
        </div>
        {ip && (
          <p className="visits-filter" role="status">
            Doar vizitele de la IP-ul <strong>{ip}</strong>.{' '}
            <button type="button" className="secondary-button" onClick={() => show({ ip: null })}>
              Arată toate IP-urile
            </button>
          </p>
        )}
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {stats && totals && (
          <div aria-busy={loading}>
            <dl className="visits-tiles">
              <div>
                <dt>Vizitatori unici</dt>
                <dd>{number(totals.visitors)}</dd>
              </div>
              <div>
                <dt>Vizite</dt>
                <dd>{number(totals.visits)}</dd>
              </div>
              <div>
                <dt>Pagini vizualizate</dt>
                <dd>{number(totals.views)}</dd>
              </div>
              <div>
                <dt>Acum pe site</dt>
                <dd>{number(totals.active)}</dd>
                <small>în ultimele 5 minute</small>
              </div>
            </dl>

            <VisitorChart buckets={stats.buckets} hourly={stats.hourly} />

            <div className="visits-rankings">
              <Ranking
                title="Pagini citite"
                empty="Nicio pagină în această perioadă."
                rows={stats.pages.map(page => ({
                  key: page.path,
                  label: (
                    <a href={page.path} target="_blank" rel="noreferrer">
                      {pageLabel(page.path, stats.titles)}
                    </a>
                  ),
                  value: page.views,
                  detail: plural(page.visitors, 'vizitator', 'vizitatori'),
                }))}
              />
              <Ranking
                title="Localități"
                empty="Nicio localitate în această perioadă."
                rows={stats.places.map(place => ({
                  key: `${place.country}|${place.region}|${place.city}`,
                  label: placeLabel(place),
                  value: place.visitors,
                  detail: plural(place.views, 'pagină', 'pagini'),
                }))}
              />
              <Ranking
                title="Țări"
                empty="Nicio țară în această perioadă."
                rows={stats.countries.map(country => ({
                  key: country.country || '-',
                  label: countryName(country.country) || 'Necunoscută',
                  value: country.visitors,
                }))}
              />
              <Ranking
                title="De unde au venit"
                empty="Nicio vizită în această perioadă."
                rows={stats.sources.map(source => ({
                  key: source.referrer || '-',
                  label: source.referrer || 'Intrare directă sau link fără sursă',
                  value: source.visits,
                }))}
              />
              <Ranking
                title="Dispozitive"
                empty="Nicio vizită în această perioadă."
                rows={stats.devices.map(device => ({
                  key: device.device || '-',
                  label: DEVICE_LABEL[device.device] ?? (device.device || 'Necunoscut'),
                  value: device.visitors,
                }))}
              />
            </div>

            <section className="visits-sessions" aria-labelledby="visits-sessions-title">
              <h2 id="visits-sessions-title">Vizite recente</h2>
              <p className="field-help">
                O vizită grupează paginile deschise de același IP, din același browser, la mai puțin de 30 de minute una
                de alta. Apasă pe un IP ca să vezi toate vizitele lui.
              </p>
              {stats.sessions.length ? (
                <ul className="shop-admin-orders">
                  {stats.sessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      titles={stats.titles}
                      until={stats.until}
                      onIp={address => show({ ip: address })}
                    />
                  ))}
                </ul>
              ) : (
                <p className="shop-admin-empty">Nicio vizită în această perioadă.</p>
              )}
              {stats.hasMore && (
                <button type="button" className="secondary-button visits-more" disabled={more} onClick={loadMore}>
                  {more ? 'Se încarcă…' : 'Vizite mai vechi'}
                </button>
              )}
            </section>
          </div>
        )}
        {!stats && loading && <p role="status">Se încarcă statistica…</p>}

        <section className="visits-notes" aria-label="Despre statistică">
          <label className="visits-ignore">
            <input type="checkbox" checked={ignored} onChange={event => toggleIgnored(event.target.checked)} />
            Nu număra vizitele mele de pe acest dispozitiv
          </label>
          <p>
            Se numără paginile deschise în browsere reale, fără roboți și fără paginile de administrare. IP-ul și datele
            browserului se șterg după {VISIT_IP_RETENTION_DAYS} de zile; numărul vizitelor, paginile și localitatea
            rămân. Vizitatorii sunt anunțați în{' '}
            <a href="/termeni#vizite" target="_blank" rel="noreferrer">
              termeni
            </a>
            .
          </p>
          <p>
            {stats?.geo
              ? `Localitatea este aproximativă, dedusă din IP pe server (baza ${stats.geo.type}, din ${time(stats.geo.built, { month: 'long', year: 'numeric' })}). `
              : stats
                ? 'Baza de localizare a IP-urilor nu este instalată încă, așa că vizitele noi nu au localitate. '
                : ''}
            <a href="https://db-ip.com" target="_blank" rel="noreferrer">
              IP Geolocation by DB-IP
            </a>{' '}
            (CC BY 4.0).
          </p>
        </section>
      </div>
    </ShopAdminFrame>
  );
}
