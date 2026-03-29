import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const angular = require('@analogjs/vite-plugin-angular').default;
const tsconfigPaths = require('vite-tsconfig-paths').default;

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
];

export function defineAngularAppConfig(appName: string, dirname: string) {
  return defineConfig({
    root: dirname,
    cacheDir: `../../node_modules/.vitest/apps/${appName}`,
    plugins: [angular(), tsconfigPaths()],
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      setupFiles: [resolve(dirname, 'src/test-setup.ts'), resolve(dirname, '../../vitest.setup.ts')],
      reporters: ['default', 'verbose'],
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: `../../coverage/apps/${appName}`,
        exclude: coverageExclude,
      },
    },
  });
}
