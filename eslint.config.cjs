// @ts-check
const typescriptParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const nx = require("@nx/eslint-plugin");
const css = require("@eslint/css");

module.exports = [
  ...nx.configs["flat/angular"],
  ...nx.configs["flat/angular-template"],
  {
    ignores: [".cache/", ".git/", "node_modules/", ".angular/", ".nx/", "dist"],
  },
  {
    plugins: {
      "@nx": nx,
    },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: ['^(?!@(?:client|health|login|server|components|services|shared|public)/)(?!apps/|libs/)(?!\\.{1,2}/).+', 'vitest.config'],
          depConstraints: [
            {
              sourceTag: "scope:node",
              onlyDependOnLibsWithTags: ["scope:node", "scope:universal"],
            },
            {
              sourceTag: "scope:angular",
              onlyDependOnLibsWithTags: ["scope:angular", "scope:universal"],
            },
            {
              sourceTag: "scope:universal",
              onlyDependOnLibsWithTags: ["scope:universal"],
            },
            {
              sourceTag: "scope:e2e",
              onlyDependOnLibsWithTags: ["*"],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "apps/client/**/*.ts",
      "apps/health/**/*.ts",
      "apps/login/**/*.ts",
      "libs/components/**/*.ts",
      "libs/services/**/*.ts",
      "libs/shared/**/*.ts",
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        projectService: true,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@angular-eslint/directive-selector": [
        "warn",
        {
          type: "attribute",
          prefix: ["ct", "he", "libc", "lo"],
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "warn",
        {
          type: "element",
          prefix: ["ct", "he", "libc", "lo"],
          style: "kebab-case",
        },
      ],
      "import/order": "off",
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/member-ordering": 0,
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            constructors: "no-public",
          },
        },
      ],
      "@typescript-eslint/naming-convention": 0,
      "@angular-eslint/no-host-metadata-property": "off",
      "@angular-eslint/no-output-on-prefix": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-inferrable-types": "off",
    },
  },
  {
    files: ["apps/server/**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        projectService: true,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "import/order": "off",
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/member-ordering": 0,
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: {
            constructors: "no-public",
          },
        },
      ],
      "@typescript-eslint/naming-convention": 0,
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-inferrable-types": "off",
    },
  },
  {
    files: ["**/*.css"],
    plugins: { css: css.default },
    language: "css/css",
    rules: {
      ...css.default.configs.recommended.rules,
      "css/no-important": "off",
      "css/no-invalid-properties": ["error", { allowUnknownVariables: true }],
      "css/use-baseline": [
        "error",
        { available: "newly", allowProperties: ["accent-color", "resize"] },
      ],
    },
  },
];
