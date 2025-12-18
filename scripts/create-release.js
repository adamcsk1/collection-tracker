const { randomUUID } = require('crypto');
const { mkdirSync, existsSync, cpSync, rmSync, readFileSync, writeFileSync, renameSync } = require('fs');

const distFolder = `${__dirname}/../dist`;
const dockerFolder = `${__dirname}/../docker`;
const dockerFile = `${__dirname}/../Dockerfile`;
const startScript = `${dockerFolder}/scripts/start.sh`;
const stopScript = `${dockerFolder}/scripts/stop.sh`;
const buildScript = `${dockerFolder}/scripts/build.sh`;
const minimalEnvFile = `${__dirname}/../.env.min.example`;
const releaseFolder = `${__dirname}/../release`;

if (!existsSync(releaseFolder)) {
  mkdirSync(releaseFolder);
  console.log(`Created folder: ${releaseFolder}`);
}

const appVersion = JSON.parse(readFileSync(`${__dirname}/../package.json`, 'utf-8')).version;

const releaseVersionFolder = `${releaseFolder}/release-${appVersion}`;

if (existsSync(releaseVersionFolder)) {
  rmSync(releaseVersionFolder, { recursive: true, force: true });
  console.log(`Removed folder: ${releaseVersionFolder}`);
}

mkdirSync(releaseVersionFolder, { recursive: true });
mkdirSync(`${releaseVersionFolder}/data`, { recursive: true });

let minimalEnv = readFileSync(minimalEnvFile, 'utf-8');
minimalEnv = minimalEnv.replace('your_jwt_secret', randomUUID().toString('hex').replace(/-/g, ''));
minimalEnv = minimalEnv.replace('your_salt', randomUUID().toString('hex').replace(/-/g, ''));
minimalEnv = minimalEnv.replace('your_cookie_secret', randomUUID().toString('hex').replace(/-/g, ''));

cpSync(distFolder, `${releaseVersionFolder}/dist`, { recursive: true });
cpSync(dockerFolder, `${releaseVersionFolder}/docker`, { recursive: true });
renameSync(`${releaseVersionFolder}/docker/README.md`, `${releaseVersionFolder}/README.md`, { recursive: true });
cpSync(dockerFile, `${releaseVersionFolder}/Dockerfile`);
cpSync(startScript, `${releaseVersionFolder}/start.sh`);
cpSync(stopScript, `${releaseVersionFolder}/stop.sh`);
cpSync(buildScript, `${releaseVersionFolder}/build.sh`);
writeFileSync(`${releaseVersionFolder}/data/.env`, minimalEnv);

console.log(`Release created at ${releaseVersionFolder}`);
