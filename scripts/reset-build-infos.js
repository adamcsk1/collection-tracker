const { writeFileSync } = require('fs');

const appConstantFilePath = `${__dirname}/../apps/client-app/src/app/app-const.ts`;

writeFileSync(
  appConstantFilePath,
  `export const BUILD = 'localhost-build';
export const BUILD_DATE = 'localhost-build-date';
export const APP_VERSION = 'localhost-version';
`,
  'utf-8'
);
