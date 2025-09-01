import type { Config } from 'jest';

const config: Config = {
  displayName: 'components',
  preset: 'jest-preset-angular',
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
  moduleFileExtensions: ['ts', 'js', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src/'],
};

export default config;
