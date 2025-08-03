const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const dayjs = require('dayjs');

const appConstantFilePath = `${__dirname}/../src/app/app.constant.ts`;
const appConstants = readFileSync(appConstantFilePath, 'utf-8');
const appVersion = JSON.parse(readFileSync(`${__dirname}/../package.json`, 'utf-8')).version;

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
const branch = execSync(`git name-rev --name-only HEAD`).toString().trim();

writeFileSync(
  appConstantFilePath,
  appConstants
    .replace('localhost-build', `${commitHash} (${branch})`)
    .replace('localhost-build-date', dayjs().toISOString())
    .replace('localhost-version', appVersion),
  'utf-8'
);
