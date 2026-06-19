import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:2999',
    specPattern: 'apps/collection-e2e/src/e2e/**/*.cy.{ts,tsx,js,jsx}',
    supportFile: 'apps/collection-e2e/src/support/e2e.ts',
    screenshotsFolder: 'apps/collection-e2e/cypress/screenshots',
    videosFolder: 'apps/collection-e2e/cypress/videos',
    video: false,
    chromeWebSecurity: false,
    allowCypressEnv: false,
  },
});
