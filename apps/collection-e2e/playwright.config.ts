import { defineConfig } from '@playwright/test';
import { firefox as patchedFirefox } from 'playwright-firefox-patched';

export default defineConfig({
  testDir: './src/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './playwright-results',
  fullyParallel: false,
  workers: 1,
  retries: 2,
  timeout: 120000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:2999',
    testIdAttribute: 'data-test-id',
    viewport: { width: 1000, height: 660 },
    actionTimeout: 15000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Remove the Firefox-only override once stable Playwright includes the fix for #43967.
    {
      name: 'firefox',
      use: { browserName: 'firefox', launchOptions: { executablePath: patchedFirefox.executablePath() } },
    },
  ],
});
