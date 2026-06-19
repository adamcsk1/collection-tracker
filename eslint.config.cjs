// @ts-check
const typescriptParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const angular = require("angular-eslint");
const css = require("@eslint/css");

const crossProjectRelativeImportPatterns = [
  {
    group: [
      "**/apps/**",
      "**/libs/**",
      "../**/client/**",
      "../**/collection-e2e/**",
      "../**/dev-proxy/**",
      "../**/health/**",
      "../**/login/**",
      "../**/server/**",
      "../**/components/**",
      "../**/public/**",
      "../**/services/**",
      "../**/shared/**",
    ],
    message: "Use declared @alias/* paths for cross-project imports.",
  },
];

/** @param {string[]} aliasPatterns */
const noRestrictedImports = (...aliasPatterns) => [
  "error",
  {
    patterns: [
      ...crossProjectRelativeImportPatterns,
      {
        group: aliasPatterns,
        message: "This project must not import from that app or library boundary.",
      },
    ],
  },
];

module.exports = [
  ...angular.configs.tsRecommended,
  ...angular.configs.templateRecommended.map((config) => ({ ...config, files: ["**/*.html"] })),
  {
    ignores: [".cache/", ".git/", "node_modules/", ".angular/", ".nx/", "dist"],
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
      "no-restricted-imports": ["error", { patterns: crossProjectRelativeImportPatterns }],
    },
  },
  {
    files: ["apps/client/**/*.ts"],
    rules: { "no-restricted-imports": noRestrictedImports("@health/*", "@login/*", "@server/*") },
  },
  {
    files: ["apps/health/**/*.ts"],
    rules: { "no-restricted-imports": noRestrictedImports("@client/*", "@login/*", "@server/*") },
  },
  {
    files: ["apps/login/**/*.ts"],
    rules: { "no-restricted-imports": noRestrictedImports("@client/*", "@health/*", "@server/*") },
  },
  {
    files: ["libs/components/**/*.ts"],
    rules: { "no-restricted-imports": noRestrictedImports("@client/*", "@health/*", "@login/*", "@server/*") },
  },
  {
    files: ["libs/services/**/*.ts"],
    rules: {
      "no-restricted-imports": noRestrictedImports("@client/*", "@health/*", "@login/*", "@server/*", "@components/*"),
    },
  },
  {
    files: ["libs/shared/**/*.ts", "libs/public/**/*.ts"],
    rules: {
      "no-restricted-imports": noRestrictedImports(
        "@client/*",
        "@health/*",
        "@login/*",
        "@server/*",
        "@components/*",
        "@services/*"
      ),
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
      "no-restricted-imports": noRestrictedImports(
        "@client/*",
        "@health/*",
        "@login/*",
        "@components/*",
        "@services/*",
        "@public/*"
      ),
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
