import type { Config } from 'jest';

const config: Config = {
  displayName: 'login',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.html$',
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@angular|rxjs|deep-equal-util|ngx-simple-signal-store|ngx-signal-translate|jest-preset-angular)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src/'],
};

export default config;
