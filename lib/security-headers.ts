// Content Security Policy and Permissions-Policy for every page (next.config.ts).
//
// The policy is enforced since 28 Nov 2026, after six days as Content-Security-Policy-Report-Only
// with no violation in the journal from a real page. Browsers still send what they block to
// /api/csp-report, which writes it to the service journal (deploy/PUBLICARE.md). Chrome shows the
// editor's PDF preview (a frame with a file or blob: address) under this policy.
//
// vinext puts the page's data in inline scripts that differ per request, so scripts need
// 'unsafe-inline'; the policy still allows code from this site only, sends data nowhere else,
// and blocks plugins, foreign forms, <base> changes and framing by other sites.
export const CSP_REPORT_PATH = '/api/csp-report';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // blob: previews in the editor before an upload; data: for small inline images.
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // The book editor shows the uploaded PDF in a frame.
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  // report-uri rather than report-to: browsers that know report-to ignore report-uri, and
  // report-to needs an absolute endpoint, which would differ between the site and its tests.
  `report-uri ${CSP_REPORT_PATH}`,
].join('; ');

// Features the site never uses are switched off for it and for anything it might embed.
export const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'hid=()',
  'bluetooth=()',
  'midi=()',
  'browsing-topics=()',
].join(', ');

export type CspReport = { directive: string; blocked: string; page: string; source: string };

const short = (value: unknown, max = 200) => (typeof value === 'string' ? value.slice(0, max) : '');
/** The page and blocked address without query strings, which may carry order keys. */
const withoutQuery = (value: string) => value.split(/[?#]/)[0];

/**
 * The violations in a report body: the Reporting API's array (application/reports+json)
 * or the older single {"csp-report": …} object (application/csp-report).
 */
export function parseCspReports(value: unknown): CspReport[] {
  const items = Array.isArray(value) ? value : [value];
  const reports: CspReport[] = [];
  for (const item of items.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const body = (entry['csp-report'] ?? (entry.type === 'csp-violation' ? entry.body : null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') continue;
    const directive = short(body.effectiveDirective ?? body['effective-directive'] ?? body['violated-directive'], 60);
    if (!directive) continue;
    const line = body.lineNumber ?? body['line-number'];
    const file = withoutQuery(short(body.sourceFile ?? body['source-file']));
    reports.push({
      directive,
      blocked: withoutQuery(short(body.blockedURL ?? body['blocked-uri'])),
      page: withoutQuery(short(body.documentURL ?? body['document-uri'])),
      source: file ? `${file}${typeof line === 'number' ? `:${line}` : ''}` : '',
    });
  }
  return reports;
}
