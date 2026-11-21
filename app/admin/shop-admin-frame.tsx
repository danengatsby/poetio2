'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Private administration uses document navigation. */
// Header shared by the shop's administration pages (orders, shop settings).
import type { ReactNode } from 'react';
import ThemeToggle from '../theme-toggle';
import './shop-admin.css';

const LINKS = [
  ['/admin', 'Poeme'],
  ['/admin/video', 'Video'],
  ['/admin/carti', 'Cărți'],
  ['/admin/comentarii', 'Comentarii'],
  ['/admin/comenzi', 'Comenzi'],
  ['/admin/magazin', 'Magazin'],
  ['/admin/functionare', 'Funcționare'],
] as const;

export default function ShopAdminFrame({
  current,
  skip,
  children,
}: {
  current: '/admin/comenzi' | '/admin/magazin';
  skip: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-page" lang="ro">
      <a className="skip-link" href="#main">
        {skip}
      </a>
      <header className="site-header shell">
        <a href="/" className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <span className="private-label">Administrare privată</span>
        <nav className="header-nav" aria-label="Navigare administrare">
          {LINKS.map(([href, label]) => (
            <a key={href} className="nav-link" href={href} aria-current={href === current ? 'page' : undefined}>
              {label}
            </a>
          ))}
          <ThemeToggle />
        </nav>
      </header>
      <main id="main" className="admin-main shop-admin-main shell">
        {children}
      </main>
    </div>
  );
}
