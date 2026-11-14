// Browser tests (browser-tests/): the built admin site in Chromium against
// a fake Supabase (browser-tests/fakeSupabase.mjs, the same fake as the
// household and collector apps'), run in CI on every pull request. Build first with the
// placeholder Supabase settings, then:
//   REACT_APP_SUPABASE_URL=https://ci-placeholder.supabase.co \
//   REACT_APP_SUPABASE_ANON_KEY=sb_publishable_ci_placeholder npx vite build
//   npm run test:browser
// PLAYWRIGHT_CHROMIUM lets a machine with its own Chromium use it.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4175;

export default defineConfig({
  testDir: 'browser-tests',
  testMatch: '**/*.e2e.mjs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block', // the PWA worker would answer from its cache, around the fake
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  },
  // Staff use the site on a laptop
  projects: [{ name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
