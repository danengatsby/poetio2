import { NextResponse, type NextRequest } from 'next/server';
import { SITE_LANGUAGE_COOKIE, SITE_LANGUAGE_HEADER, siteLanguage } from './lib/site-language';

export function proxy(request: NextRequest) {
  const language = siteLanguage(request.nextUrl.searchParams.get('lang'), request.cookies.get(SITE_LANGUAGE_COOKIE)?.value);
  const headers = new Headers(request.headers);
  // Always replace the incoming value: layouts and pages share this request's
  // resolution, rather than trusting a caller-provided language header.
  headers.set(SITE_LANGUAGE_HEADER, language);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/', '/poeme/:path*', '/video/:path*', '/carti/:path*', '/autor', '/admin/:path*'],
};
