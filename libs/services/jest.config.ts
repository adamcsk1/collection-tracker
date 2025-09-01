import type { Config } from 'jest';

const config: Config = {
  displayName: 'services',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'js'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src/'],
};

export default config;
