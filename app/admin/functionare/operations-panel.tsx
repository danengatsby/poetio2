'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Keep document navigation in the administration. */
import { useEffect, useState } from 'react';
import type { OperationsResult } from '@/lib/operations';
import ThemeToggle from '../../theme-toggle';
import './operations.css';

const date = (value: string) => new Date(value).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const bytes = (value: number) => {
  const unit = value >= 1024 ** 3 ? 3 : value >= 1024 ** 2 ? 2 : value >= 1024 ? 1 : 0;
  return `${(value / 1024 ** unit).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ${['B', 'KiB', 'MiB', 'GiB'][unit]}`;
};
const operationLabel: Record<string, string> = { checkUpload: 'verificare la încărcare', validation: 'verificare înainte de publicare', info: 'citirea documentului', page: 'randarea paginii', text: 'extragerea textului', render: 'procesarea imaginii' };
export default function OperationsPanel() {
  const [data, setData] = useState<OperationsResult | null>(null), [error, setError] = useState('');
  const [version, setVersion] = useState(0), [busy, setBusy] = useState(false);
  useEffect(() => {
    let pending: AbortController | null = null;
    async function refresh() {
      if (pending) return;
      const abort = new AbortController(); pending = abort; setBusy(true);
      try {
        const response = await fetch('/api/admin/operations', { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error(response.status === 401 ? 'Autentifică-te din nou pentru a vedea starea.' : 'Starea nu poate fi actualizată. Reîncearcă.');
        const result = await response.json();
        if (!abort.signal.aborted) { setData(result); setError(''); }
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Starea nu poate fi actualizată.'); }
      finally { if (!abort.signal.aborted) setBusy(false); pending = null; }
    }
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    return () => { clearInterval(timer); pending?.abort(); };
  }, [version]);
  return <div className="admin-page" lang="ro">
    <a className="skip-link" href="#main">Mergi la starea site-ului</a>
    <header className="site-header shell"><a href="/" className="wordmark">Poetio<span aria-hidden="true">✳</span></a><span className="private-label">Administrare privată</span><nav className="header-nav" aria-label="Navigare administrare"><a className="nav-link" href="/admin">Poeme</a><a className="nav-link" href="/admin/video">Video</a><a className="nav-link" href="/admin/carti">Cărți</a><a className="nav-link" href="/admin/comentarii">Comentarii</a><a className="nav-link" href="/admin/functionare" aria-current="page">Funcționare</a><ThemeToggle /></nav></header>
    <main id="main" className="admin-main operations-main shell">
      <div className="admin-heading"><div><p className="eyebrow">Starea site-ului</p><h1>Funcționare</h1><p>Actualizare la un minut cât timp fila este vizibilă.</p></div><button type="button" className="secondary-button" disabled={busy} onClick={() => setVersion(value => value + 1)}>{busy ? 'Se actualizează…' : 'Actualizează starea'}</button></div>
      {error && <p role="alert">{error} {data && 'Valorile afișate sunt de la ultima citire reușită.'}</p>}
      {!data && !error && <p role="status">Se încarcă starea…</p>}
      {data?.available === false && <p role="status">Monitorizarea serverului nu este disponibilă în acest mediu. Starea backupului și a spațiului liber nu este cunoscută.</p>}
      {data?.available && <>
        <p>Ultima citire: <time dateTime={data.sampledAt}>{date(data.sampledAt)}</time></p>
        <div className="operations-grid">
          <section className="operations-card" data-state={data.backup.lastAttempt === 'failed' || data.backup.scheduled === false ? 'error' : data.backup.state}><h2>Backup verificat</h2>
            <p className="operations-state">{{ ok: 'Backup recent verificat', overdue: 'Backup restant — au trecut peste 36 de ore', missing: 'Nu există dovada unui backup disponibil și verificat', unknown: 'Starea backupului este necunoscută sau neactualizată' }[data.backup.state]}</p>
            {data.backup.verified && <><p>Ultima copie verificată prin restaurare: <time dateTime={data.backup.verified.createdAt}>{date(data.backup.verified.createdAt)}</time></p><p>{data.backup.verified.archive} · {bytes(data.backup.verified.bytes)}</p></>}
            <p>Ultima execuție: {{ success: 'reușită', failed: 'eșuată — necesită verificare', running: 'în desfășurare', unknown: 'necunoscută' }[data.backup.lastAttempt]}.</p>
            <p>Programare automată: {data.backup.scheduled === null ? 'necunoscută' : data.backup.scheduled ? 'activă' : 'oprită — necesită verificare'}.</p>
            {data.backup.sampledAt && <p>Rezumat de la {date(data.backup.sampledAt)}.</p>}
            {(data.backup.state !== 'ok' || data.backup.lastAttempt === 'failed' || data.backup.scheduled === false) && <p>Verifică serviciul de backup și ultima restaurare înainte de a considera copia sigură.</p>}
          </section>
          <section className="operations-card" data-state={data.disk.state}><h2>Spațiu pentru date</h2><p className="operations-state">{data.disk.state === 'low' ? 'Spațiu redus — necesită intervenție' : data.disk.state === 'ok' ? 'Spațiu disponibil' : 'Spațiul liber nu poate fi citit'}</p>
            {data.disk.free !== null && data.disk.total !== null && <><p>{bytes(data.disk.free)} liberi din {bytes(data.disk.total)}.</p><meter min={0} max={data.disk.total} value={data.disk.total - data.disk.free} aria-label="Spațiu ocupat" /></>}
            <p>Avertizare sub 1 GiB sau sub 10% liber pe discul datelor.</p>
          </section>
          <section className="operations-card"><h2>Versiune instalată</h2><p>{data.runtime.release}</p><p>Proces pornit la {date(data.runtime.startedAt)}.</p><p>Node {data.runtime.node}</p></section>
        </div>
        <section className="operations-card operations-media"><h2>Erori media observate</h2><p>Procesare PDF, extragere/OCR, imagini și decodare audio/video pe server, de la pornirea procesului. Maximum 20 de grupuri recente; contorul include și reîncercările. Redarea audio/video în browser se verifică prin previzualizare.</p>
          {data.media.length ? <ul>{data.media.map((item, index) => <li key={index}><strong>{item.kind === 'book' ? 'Carte PDF' : item.kind === 'media' ? 'Audio/video' : 'Imagine'} — {({ invalid: 'fișier invalid', encrypted: 'PDF protejat', unsupported: 'format de redare neacceptat', limits: 'limită de procesare depășită', unavailable: 'procesare indisponibilă' } as Record<string, string>)[item.code]}</strong><p>{date(item.at)} · {item.count} {item.count === 1 ? 'observație' : 'observații'} · {operationLabel[item.operation] || 'procesare media'}</p>{item.fileId && <p>Fișier: <code>{item.fileId}</code></p>}<p>Verifică fișierul în editor și reîncearcă; dacă eroarea persistă, verifică serviciul de procesare.</p></li>)}</ul> : <p>Nu au fost observate erori în această perioadă. Fișierele neaccesate nu au fost reverificate.</p>}
        </section>
      </>}
    </main>
  </div>;
}
