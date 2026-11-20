import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.POETIO_E2E_PORT || 4310);

// Browser tests against the built VPS server (`npm run build:vps` first) and a
// throwaway database; see tests/e2e/server.mjs.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    // Answers once the server is up and the test poems are in.
    url: `http://127.0.0.1:${port + 1}/ready`,
    env: { POETIO_E2E_PORT: String(port) },
    timeout: 120_000,
    // SIGTERM lets tests/e2e/server.mjs stop the app and delete its data directory.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    stdout: 'pipe',
  },
});
