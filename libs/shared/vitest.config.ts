import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const angular = require('@analogjs/vite-plugin-angular').default;
const tsconfigPaths = require('vite-tsconfig-paths').default;

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vitest/libs/shared',
  plugins: [angular(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    setupFiles: [resolve(__dirname, 'src/test-setup.ts'), resolve(__dirname, '../../vitest.setup.ts')],
    reporters: ['default', 'verbose'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: '../../coverage/libs/shared',
      exclude: [
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
      ],
    },
  },
});
