import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { coverageExclude } from './vitest.config';

const require = createRequire(import.meta.url);
const angular = require('@analogjs/vite-plugin-angular').default;
const tsconfigPaths = require('vite-tsconfig-paths').default;

const defineAngularConfig = (appName: string, dirname: string, target: 'apps' | 'lib' = 'apps') =>
  defineConfig({
    root: dirname,
    cacheDir: `../../node_modules/.vitest/${target}/${appName}`,
    plugins: [angular(), tsconfigPaths()],
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
      setupFiles: [resolve(dirname, 'src/test-setup.ts'), resolve(dirname, '../../vitest.setup.ts')],
      pool: 'forks',
      isolate: true,
      reporters: ['default', 'verbose'],
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: `../../coverage/${target}/${appName}`,
        exclude: coverageExclude,
      },
    },
  });

export const defineAngularAppConfig = (appName: 'client' | 'login' | 'health', dirname: string) =>
  defineAngularConfig(appName, dirname);

export const defineAngularLibConfig = (appName: 'components' | 'services' | 'shared', dirname: string) =>
  defineAngularConfig(appName, dirname, 'lib');
