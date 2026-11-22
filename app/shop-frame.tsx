'use client';
// Header, footer and language handling shared by the shop pages (cart, checkout, order, terms).
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import type { SiteLanguage } from '@/lib/poem-types';
import { cartCount, useCart } from '@/lib/cart';
import { pick, rememberSiteLanguage, siteCopy, withSiteLanguage } from '@/lib/site-language';
import SiteHeader from './site-header';
import './shop.css';
import LegalLinks from './legal-links';

export function useShopLanguage(initial: SiteLanguage) {
  const router = useRouter();
  const [language, setLanguage] = useState(initial);
  function change(value: SiteLanguage) {
    setLanguage(value);
    rememberSiteLanguage(value);
    router.refresh();
  }
  return [language, change] as const;
}

/** "Coș (2)", linking to the cart. The count is read in the browser only. */
export function CartLink({ language, current = false }: { language: SiteLanguage; current?: boolean }) {
  const count = cartCount(useCart());
  return (
    <a className="shop-cart-link" href={withSiteLanguage('/cos', language)} aria-current={current ? 'page' : undefined}>
      <ShoppingCart size={20} aria-hidden="true" />
      <span>{pick(language, 'Coș', 'Cart', 'Panier')}</span>
      <span
        className="shop-cart-count"
        aria-label={pick(language, `${count} produse`, `${count} items`, `${count} article${count > 1 ? 's' : ''}`)}
      >
        {count}
      </span>
    </a>
  );
}

export default function ShopFrame({
  language,
  onLanguageChange,
  children,
  cart = true,
  cartCurrent = false,
  back,
}: {
  language: SiteLanguage;
  onLanguageChange: (language: SiteLanguage) => void;
  children: ReactNode;
  cart?: boolean;
  cartCurrent?: boolean;
  back?: { href: string; label: string };
}) {
  const copy = siteCopy[language];
  return (
    <>
      <a className="skip-link" href="#main">
        {pick(language, 'Mergi la conținut', 'Skip to content', 'Aller au contenu')}
      </a>
      <SiteHeader language={language} onLanguageChange={onLanguageChange} booksPage />
      <main id="main" className="shop shell" lang={language}>
        <div className="shop-bar">
          {back ? (
            <a className="book-back" href={back.href}>
              ← {back.label}
            </a>
          ) : (
            <span />
          )}
          {cart && <CartLink language={language} current={cartCurrent} />}
        </div>
        {children}
      </main>
      <footer className="site-footer shell">
        <a href={withSiteLanguage('/', language)} className="wordmark">
          Poetio<span aria-hidden="true">✳</span>
        </a>
        <p>
          {copy.footer} · <LegalLinks language={language} />
        </p>
        <a href="#" className="back-top">
          {copy.back} ↑
        </a>
      </footer>
    </>
  );
}
