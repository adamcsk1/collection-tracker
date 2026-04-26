#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs');
const { globSync } = require('glob');
const { resolve } = require('path');

const root = resolve(__dirname, '..');

const files = [
  ...globSync('apps/*/public/i18n/*.json', { cwd: root }),
];

if (files.length === 0) {
  console.log('No i18n files found.');
  process.exit(0);
}

let changed = 0;

for (const relPath of files) {
  const absPath = resolve(root, relPath);
  const original = readFileSync(absPath, 'utf8');
  const parsed = JSON.parse(original);

  const sorted = Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)));

  const output = JSON.stringify(sorted, null, 2) + '\n';

  if (output !== original) {
    writeFileSync(absPath, output, 'utf8');
    console.log(`sorted: ${relPath}`);
    changed++;
  } else {
    console.log(`ok:     ${relPath}`);
  }
}

console.log(`\n${changed} file(s) updated.`);
