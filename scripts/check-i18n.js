#!/usr/bin/env node

const { readFileSync } = require('fs');
const { globSync } = require('glob');
const { resolve } = require('path');

const root = resolve(__dirname, '..');

const TS_PATTERN = /\.translate\$?\(\s*['"]([^'"]+)['"]/g;

// i18n keys always start with an uppercase letter and contain only word chars and dots.
const I18N_KEY_PATTERN = /^[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*$/;

const getSourceFiles = (appName) => {
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

const extractUsedKeys = (files) => {
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
      TS_PATTERN.lastIndex = 0;
      let match;
      while ((match = TS_PATTERN.exec(content)) !== null) {
        used.add(match[1]);
      }
    }
  }

  return used;
};

const i18nFiles = globSync('apps/*/public/i18n/*.json', { cwd: root });

if (i18nFiles.length === 0) {
  console.log('No i18n files found.');
  process.exit(0);
}

let totalUnused = 0;
let totalMissing = 0;

for (const relI18nPath of i18nFiles) {
  const appName = relI18nPath.split(/[\\/]/)[1];

  const absI18nPath = resolve(root, relI18nPath);
  const i18nKeys = Object.keys(JSON.parse(readFileSync(absI18nPath, 'utf8')));
  const i18nKeySet = new Set(i18nKeys);

  const sourceFiles = getSourceFiles(appName);
  const usedKeys = extractUsedKeys(sourceFiles);

  const unusedKeys = i18nKeys.filter((key) => !usedKeys.has(key));
  const missingKeys = [...usedKeys].filter((key) => !i18nKeySet.has(key)).sort();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`App     : ${appName}`);
  console.log(`File    : ${relI18nPath}`);
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
