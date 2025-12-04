import type { Config } from 'jest';

const config: Config = {
  displayName: 'server',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': '@swc/jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(random-words)/)'],
  moduleFileExtensions: ['ts', 'js'],
  setupFilesAfterEnv: ['<rootDir>/test/test-setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).ts'],
  roots: ['<rootDir>/src/'],
};

export default config;
