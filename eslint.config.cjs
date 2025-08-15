// @ts-check
const prettierPlugin = require('eslint-plugin-prettier');
const typescriptParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const angularPlugin = require('@angular-eslint/eslint-plugin');
const angularTemplateParser = require('@angular-eslint/template-parser');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const nx = require('@nx/eslint-plugin');

module.exports = [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    ignores: ['.cache/', '.git/', 'node_modules/', '.angular/', '.nx/', 'dist'],
  },
  {
    files: [
      'apps/client/**/*.ts',
      'apps/login/**/*.ts',
      'libs/components/**/*.ts',
      'libs/services/**/*.ts',
      'libs/shared/**/*.ts',
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.app.json', './tsconfig.spec.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...angularPlugin.configs.recommended.rules,
      ...prettierPlugin.configs?.rules,
      '@angular-eslint/directive-selector': [
        'warn',
        {
          type: 'attribute',
          prefix: ['ct', 'libc', 'lo'],
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'warn',
        {
          type: 'element',
          prefix: ['ct', 'libc', 'lo'],
          style: 'kebab-case',
        },
      ],
      'import/order': 'off',
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/member-ordering': 0,
      '@typescript-eslint/naming-convention': 0,
      '@angular-eslint/no-host-metadata-property': 'off',
      '@angular-eslint/no-output-on-prefix': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  {
    files: ['apps/client/**/*.html', 'apps/login/**/*.html', 'libs/components/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': ['error', { parser: 'angular' }],
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.app.json', './tsconfig.spec.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierPlugin.configs?.rules,
      'import/order': 'off',
      '@typescript-eslint/no-explicit-any': ['off'],
      '@typescript-eslint/member-ordering': 0,
      '@typescript-eslint/naming-convention': 0,
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  eslintPluginPrettierRecommended,
];
