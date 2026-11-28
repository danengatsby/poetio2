import type { NextConfig } from 'next';
import { CONTENT_SECURITY_POLICY, PERMISSIONS_POLICY } from './lib/security-headers';

const nextConfig: NextConfig = {
  // Resolve metadata before the HTML head is sent, including for browsers with
  // JavaScript disabled. These pages read metadata from the local content DB.
  htmlLimitedBots: /.*/,
  // nginx adds HSTS, nosniff, Referrer-Policy and X-Frame-Options (deploy/poetio-app.conf).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;
