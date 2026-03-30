import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:2999',
    specPattern: 'src/e2e/**/*.cy.{ts,tsx,js,jsx}',
    supportFile: 'src/support/e2e.ts',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: false,
    chromeWebSecurity: false,
    allowCypressEnv: false,
  },
});
