// The browser tests' `test`: like Playwright's, plus a check that no page opened during a test
// trips the Content Security Policy (report-only in production; lib/security-headers.ts).
import { expect, test as base } from '@playwright/test';

export { expect };

export const test = base.extend({
  cspViolations: [
    async ({ page }, use) => {
      const violations = [];
      await page.exposeFunction('__poetioCspViolation', text => violations.push(text));
      await page.addInitScript(() =>
        document.addEventListener('securitypolicyviolation', event =>
          window.__poetioCspViolation(`${event.effectiveDirective} ${event.blockedURI} on ${location.pathname}`),
        ),
      );
      await use(violations);
      expect(violations, 'Content Security Policy violations').toEqual([]);
    },
    { auto: true },
  ],
});
