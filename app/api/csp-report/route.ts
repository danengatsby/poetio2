import { AppError, apiError, readJson } from '@/lib/access';
import { createRateLimit } from '@/lib/rate-limit';
import { parseCspReports } from '@/lib/security-headers';

export const dynamic = 'force-dynamic';

// At most this many violations are written to the journal per hour, so a page with a
// repeating violation, or someone posting reports, cannot flood it.
const logged = createRateLimit(200, 3_600_000);
const TYPES = ['application/csp-report', 'application/reports+json', 'application/json'];

// Browsers report what the Content Security Policy would have blocked (lib/security-headers.ts).
export async function POST(request: Request) {
  try {
    const type = request.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!TYPES.includes(type)) throw new AppError(415, 'Formatul cererii nu este acceptat.');
    for (const report of parseCspReports(await readJson(request, 16_384))) {
      if (!logged.allows('all')) break;
      logged.record('all');
      console.warn(
        `CSP violation: ${report.directive} blocked ${report.blocked || '(inline)'} on ${report.page}` +
          (report.source ? ` at ${report.source}` : ''),
      );
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
