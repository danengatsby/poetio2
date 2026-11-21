'use client';
// Reports each page of the public site to /api/visits, for /admin/vizite. No cookies:
// the server groups page views by IP address and browser.
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { VISIT_IGNORE_KEY } from '@/lib/visits';

export default function VisitTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
    try {
      if (localStorage.getItem(VISIT_IGNORE_KEY) === '1') return;
    } catch {
      /* Storage blocked: count the visit. */
    }
    // Only the first page of a visit carries the site the visitor came from.
    const referrer = first.current ? document.referrer : '';
    first.current = false;
    const send = () =>
      void fetch('/api/visits', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname, referrer, language: document.documentElement.lang }),
      }).catch(() => {});
    // A page the browser prerenders counts only once the reader actually opens it.
    const page = document as Document & { prerendering?: boolean };
    if (page.prerendering) document.addEventListener('prerenderingchange', send, { once: true });
    else send();
  }, [pathname]);

  return null;
}
