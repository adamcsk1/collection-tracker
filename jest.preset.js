// Nx Jest preset to handle TS paths and sane defaults
const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
};
