import { env } from 'cloudflare:workers';

/**
 * The visitor's IP address, read only from a header the platform sets: X-Real-IP from nginx
 * on the VPS (server/vps-env.ts names it), CF-Connecting-IP from Cloudflare on the Worker.
 * Any other copy of these headers comes from the visitor and is ignored.
 */
export function clientIp(request: Request) {
  return (request.headers.get(clientIpHeader()) ?? '').trim();
}

/** True on Cloudflare, where CF-* request headers come from Cloudflare itself. */
export const behindCloudflare = () => clientIpHeader() === 'cf-connecting-ip';

const clientIpHeader = () =>
  (env as unknown as { CLIENT_IP_HEADER?: string }).CLIENT_IP_HEADER?.toLowerCase() || 'cf-connecting-ip';
