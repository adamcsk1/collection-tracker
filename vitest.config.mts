import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [...configDefaults.exclude, 'apps/collection-e2e/**'],
    globals: true,
    environment: 'jsdom',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
