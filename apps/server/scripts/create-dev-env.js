const { mkdirSync, existsSync, cpSync, readFileSync, appendFileSync } = require('fs');

const dataFolder = `${__dirname}/../../../.data`;
const devEnvFile = `${__dirname}/.env.dev`;
const envFile = `${dataFolder}/.env`;
const devOllamaConfigFile = `${__dirname}/ollama.config.json`;
const ollamaConfigFile = `${dataFolder}/ollama.config.json`;
const devBackgroundConfigFile = `${__dirname}/background.config.json`;
const backgroundConfigFile = `${dataFolder}/background.config.json`;

if (!existsSync(dataFolder)) {
  mkdirSync(dataFolder);
  console.log(`Created folder: ${dataFolder}`);
} else console.log(`Folder already exists: ${dataFolder}`);

if (!existsSync(envFile)) {
  cpSync(devEnvFile, envFile);
  console.log(`Created file: ${envFile}`);
} else {
  console.log(`File already exists: ${envFile}`);
  const envText = readFileSync(envFile, { encoding: 'utf-8' });
  if (!/^METADATA_SERVICE_URL=/m.test(envText)) {
    appendFileSync(envFile, '\nMETADATA_SERVICE_URL=http://127.0.0.1:3002\n');
    console.log(`Added METADATA_SERVICE_URL to ${envFile}`);
  }
}

if (!existsSync(ollamaConfigFile)) {
  cpSync(devOllamaConfigFile, ollamaConfigFile);
  console.log(`Created file: ${ollamaConfigFile}`);
} else console.log(`File already exists: ${ollamaConfigFile}`);

if (!existsSync(backgroundConfigFile)) {
  cpSync(devBackgroundConfigFile, backgroundConfigFile);
  console.log(`Created file: ${backgroundConfigFile}`);
} else console.log(`File already exists: ${backgroundConfigFile}`);
