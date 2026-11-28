// The browser tests' `test`: like Playwright's, plus a check that no page opened during a test
// trips the Content Security Policy (enforced in production; lib/security-headers.ts).
import { expect, test as base } from '@playwright/test';

export { expect };

// The standalone reader is also reachable through a shared poem URL.
export async function openSelectedPoemPage(page) {
  const selection = page.locator('.collection-titles [aria-current]');
  const id = await selection.getAttribute('data-poem-id');
  const returnTo = await selection.getAttribute('href');
  const lang = new URL(returnTo, page.url()).searchParams.get('lang');
  await page.goto('/poeme/' + encodeURIComponent(id) + '?' + new URLSearchParams({ lang, returnTo }));
}

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
