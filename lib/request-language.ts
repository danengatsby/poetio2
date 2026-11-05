import { cookies, headers } from 'next/headers';
import { SITE_LANGUAGE_COOKIE, SITE_LANGUAGE_HEADER, siteLanguage } from './site-language';

// Shared by server layouts, pages and generateMetadata. The proxy resolves the
// URL first; cookies remain the fallback for routes outside its matcher.
export async function requestLanguage() {
  return siteLanguage((await headers()).get(SITE_LANGUAGE_HEADER), (await cookies()).get(SITE_LANGUAGE_COOKIE)?.value);
}
