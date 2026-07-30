import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { coverageExclude } from '../../vitest.coverage-exclude';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vitest/apps/server',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    setupFiles: [resolve(__dirname, 'test/test-setup.ts'), resolve(__dirname, '../../vitest.setup.ts')],
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
