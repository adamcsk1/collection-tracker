import { defineConfig } from 'vitest/config';

export const coverageExclude = [
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

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
