const { mkdirSync, existsSync, cpSync } = require('fs');

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
} else console.log(`File already exists: ${envFile}`);

if (!existsSync(ollamaConfigFile)) {
  cpSync(devOllamaConfigFile, ollamaConfigFile);
  console.log(`Created file: ${ollamaConfigFile}`);
} else console.log(`File already exists: ${ollamaConfigFile}`);

if (!existsSync(backgroundConfigFile)) {
  cpSync(devBackgroundConfigFile, backgroundConfigFile);
  console.log(`Created file: ${backgroundConfigFile}`);
} else console.log(`File already exists: ${backgroundConfigFile}`);
