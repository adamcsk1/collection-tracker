#!/usr/bin/env node

const { readFileSync } = require('fs');
const { globSync } = require('glob');
const { resolve } = require('path');

const root = resolve(__dirname, '..');

const APP_TS_PATTERN = /\.translate\$?\(\s*['"]([^'"]+)['"]/g;

// i18n keys always start with an uppercase letter and contain only word chars and dots.
const I18N_KEY_PATTERN = /^[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*$/;

const resolveAppSourceFiles = (appName) => {
  const appSrc = globSync(`apps/${appName}/src/**/*.{ts,html}`, { cwd: root });
  const libsSrc = globSync('libs/**/src/**/*.{ts,html}', { cwd: root, ignore: ['**/coverage/**', '**/*.spec.ts'] });
  return [...appSrc, ...libsSrc];
};

const extractKeysFromHtml = (content, used) => {
  let searchFrom = 0;

  while (true) {
    const pipePos = content.indexOf('| signalTranslate', searchFrom);
    if (pipePos === -1) break;

    const windowStart = Math.max(0, pipePos - 500);
    const window = content.slice(windowStart, pipePos);

    const exprStart = Math.max(window.lastIndexOf('{{'), window.lastIndexOf('="'), window.lastIndexOf('=\''));
    const expr = exprStart >= 0 ? window.slice(exprStart) : window;

    const strPattern = /'([^']+)'/g;
    let match;
    while ((match = strPattern.exec(expr)) !== null) {
      if (I18N_KEY_PATTERN.test(match[1])) {
        used.add(match[1]);
      }
    }

    searchFrom = pipePos + 1;
  }
};

const extractKeysWithPattern = (files, pattern) => {
  const used = new Set();

  for (const relPath of files) {
    const absPath = resolve(root, relPath);
    let content;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      used.add(match[1]);
    }
  }

  return used;
};

const extractAppUsedKeys = (files) => {
  const used = new Set();

  for (const relPath of files) {
    const absPath = resolve(root, relPath);
    let content;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    if (relPath.endsWith('.html')) {
      extractKeysFromHtml(content, used);
    } else {
      APP_TS_PATTERN.lastIndex = 0;
      let match;
      while ((match = APP_TS_PATTERN.exec(content)) !== null) {
        used.add(match[1]);
      }
    }
  }

  return used;
};

// --------------------------------------------------------------------------
// Target descriptors — one entry per i18n file to check
// --------------------------------------------------------------------------

const buildAppTargets = () =>
  globSync('apps/*/public/i18n/*.json', { cwd: root }).map((i18nPath) => ({
    name: i18nPath.split(/[\\/]/)[1],
    i18nPath,
    getSourceFiles: () => resolveAppSourceFiles(i18nPath.split(/[\\/]/)[1]),
    extractUsedKeys: extractAppUsedKeys,
  }));

const targets = [...buildAppTargets()];

if (targets.length === 0) {
  console.log('No i18n files found.');
  process.exit(0);
}

// --------------------------------------------------------------------------
// Check each target
// --------------------------------------------------------------------------

let totalUnused = 0;
let totalMissing = 0;

for (const target of targets) {
  const absI18nPath = resolve(root, target.i18nPath);
  const i18nKeys = Object.keys(JSON.parse(readFileSync(absI18nPath, 'utf8')));
  const i18nKeySet = new Set(i18nKeys);

  const sourceFiles = target.getSourceFiles();
  const usedKeys = target.extractUsedKeys(sourceFiles);

  const unusedKeys = i18nKeys.filter((key) => !usedKeys.has(key));
  const missingKeys = [...usedKeys].filter((key) => !i18nKeySet.has(key)).sort();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`App     : ${target.name}`);
  console.log(`File    : ${target.i18nPath}`);
  console.log(`Scanned : ${sourceFiles.length} source files`);
  console.log(`Keys    : ${i18nKeys.length} defined — ${unusedKeys.length} unused, ${missingKeys.length} missing`);

  if (unusedKeys.length > 0) {
    console.log('\nUnused keys (in JSON but not referenced in source):');
    for (const key of unusedKeys) {
      console.log(`  - ${key}`);
    }
    totalUnused += unusedKeys.length;
  }

  if (missingKeys.length > 0) {
    console.log('\nMissing keys (referenced in source but not in JSON):');
    for (const key of missingKeys) {
      console.log(`  - ${key}`);
    }
    totalMissing += missingKeys.length;
  }

  if (unusedKeys.length === 0 && missingKeys.length === 0) {
    console.log('\nAll keys are in sync.');
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Total unused : ${totalUnused}`);
console.log(`Total missing: ${totalMissing}`);

if (totalUnused > 0 || totalMissing > 0) {
  process.exit(1);
}
