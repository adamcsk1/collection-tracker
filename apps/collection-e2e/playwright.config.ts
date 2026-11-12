import { defineConfig } from '@playwright/test';

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
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
