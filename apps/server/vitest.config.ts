import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const coverageExclude = [
  '**/coverage/*',
  '**/mocks/*',
  '**/index.ts',
  '**/*-model.ts',
  '**/*-config.ts',
  '**/bootstrap.ts',
  '**/*-routes.ts',
  '**/*-const.ts',
  '**/*.config.ts',
  '**/*.config.cjs',
  '**/scripts/*',
  '**/*.html',
  '**/*.css',
];

const require = createRequire(import.meta.url);
const tsconfigPaths = require('vite-tsconfig-paths').default;

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vitest/apps/server',
  plugins: [tsconfigPaths()],
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
