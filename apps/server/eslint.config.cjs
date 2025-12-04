const baseConfig = require('../../eslint.config.cjs');

module.exports = [
  ...baseConfig,
  {
    files: ['apps/server/src/apis/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
