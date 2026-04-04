#!/usr/bin/env node

'use strict';

const { readFileSync, writeFileSync } = require('fs');
const { execSync } = require('child_process');

const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf-8' })
  .split('\n')
  .map((fileName) => fileName.trim())
  .filter((fileName) => fileName.endsWith('.sh'));

if (stagedFiles.length === 0) {
  process.exit(0);
}

for (const filePath of stagedFiles) {
  const original = readFileSync(filePath, 'utf-8');
  const fixed = original.replace(/\r\n/g, '\n');

  if (fixed !== original) {
    writeFileSync(filePath, fixed, 'utf-8');
    execSync(`git add ${filePath}`);
    console.log(`Fixed EOL: ${filePath}`);
  }
}
