import { getPoemDb } from '@/db/binding';
import { behindCloudflare, clientIp } from '@/db/client-ip';
import { getGeoLocator } from '@/db/geo-binding';
import { recordVisit } from '@/db/visits';
import { AppError, apiError, isOwnerEmail, readJson, requireSameOrigin } from '@/lib/access';
import type { PlaceFields } from '@/lib/visits';

export const dynamic = 'force-dynamic';

type CloudflareRequest = Request & { cf?: { country?: string; region?: string; city?: string } };

function place(request: CloudflareRequest, ip: string): PlaceFields | null {
  const cf = request.cf;
  if (cf?.country) return { country: cf.country, region: cf.region ?? '', city: cf.city ?? '' };
  const located = ip ? getGeoLocator()?.lookup(ip) : null;
  if (located) return located;
  if (!behindCloudflare()) return null;
  const country = request.headers.get('cf-ipcountry');
  return country && /^[A-Z]{2}$/.test(country) ? { country, region: '', city: '' } : null;
}

// One page view of the public site, reported by the page itself (app/visit-tracker.tsx).
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError(415, 'Formatul cererii nu este acceptat.');
    const body = ((await readJson(request, 2_048)) ?? {}) as Record<string, unknown>;
    // The owner's own reading, signed in to the administration, is not counted.
    if (!isOwnerEmail(request.headers.get('oai-authenticated-user-email'))) {
      const ip = clientIp(request);
      await recordVisit(getPoemDb(), {
        path: body.path,
        referrer: body.referrer,
        language: body.language,
        ip,
        userAgent: request.headers.get('user-agent') ?? '',
        siteHost: new URL(request.url).host,
        place: place(request as CloudflareRequest, ip),
      });
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
