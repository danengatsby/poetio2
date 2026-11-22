import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const security = await tsImport('../lib/security-headers.ts', import.meta.url);

test('the policy allows only this site and reports to /api/csp-report', () => {
  const policy = security.CONTENT_SECURITY_POLICY;
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'self'/);
  assert.match(policy, /report-uri \/api\/csp-report/);
  assert.doesNotMatch(policy, /https?:|\*/);
  assert.match(security.PERMISSIONS_POLICY, /camera=\(\), microphone=\(\), geolocation=\(\)/);
});

test('reads both report formats and drops query strings that may hold order keys', () => {
  assert.deepEqual(
    security.parseCspReports({
      'csp-report': {
        'document-uri': 'https://poetio.cloud/comanda/abc?cheie=secret',
        'violated-directive': 'img-src',
        'blocked-uri': 'https://evil.example/pixel.gif?x=1',
        'source-file': 'https://poetio.cloud/_next/static/a.js',
        'line-number': 3,
      },
    }),
    [
      {
        directive: 'img-src',
        blocked: 'https://evil.example/pixel.gif',
        page: 'https://poetio.cloud/comanda/abc',
        source: 'https://poetio.cloud/_next/static/a.js:3',
      },
    ],
  );
  assert.deepEqual(
    security.parseCspReports([
      {
        type: 'csp-violation',
        body: { documentURL: 'https://poetio.cloud/', effectiveDirective: 'script-src-elem', blockedURL: 'inline' },
      },
      { type: 'deprecation', body: { id: 'x' } },
      null,
    ]),
    [{ directive: 'script-src-elem', blocked: 'inline', page: 'https://poetio.cloud/', source: '' }],
  );
  assert.deepEqual(security.parseCspReports('nu'), []);
  assert.equal(security.parseCspReports(Array(50).fill({ 'csp-report': { 'violated-directive': 'x' } })).length, 20);
});
