import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { coverageExclude } from '../../vitest.coverage-exclude.mts';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vitest/apps/server',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    setupFiles: [
      resolve(import.meta.dirname, 'test/test-setup.ts'),
      resolve(import.meta.dirname, '../../vitest.setup.ts'),
    ],
    reporters: ['default', 'verbose'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/apps/server',
      exclude: [...coverageExclude],
    },
  },
});
