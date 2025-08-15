const { mkdirSync, existsSync, cpSync } = require('fs');

const dataFolder = `${__dirname}/../../../.data`;
const devEnvFile = `${__dirname}/.env.dev`;
const envFile = `${dataFolder}/.env`;

if (!existsSync(dataFolder)) {
  mkdirSync(dataFolder);
  console.log(`Created folder: ${dataFolder}`);
} else console.log(`Folder already exists: ${dataFolder}`);

if (!existsSync(envFile)) {
  cpSync(devEnvFile, envFile);
  console.log(`Created file: ${envFile}`);
} else console.log(`File already exists: ${envFile}`);
