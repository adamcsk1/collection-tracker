import type { Config } from 'jest';

const config: Config = {
  displayName: 'client',
  preset: 'jest-preset-angular',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
  },
  roots: ['<rootDir>/src/'],
};

export default config;
