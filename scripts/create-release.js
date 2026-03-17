const { randomUUID } = require('crypto');
const { mkdirSync, existsSync, cpSync, rmSync, readFileSync, writeFileSync, renameSync } = require('fs');

const distFolder = `${__dirname}/../dist`;
const dockerFolder = `${__dirname}/../docker`;
const dockerFile = `${__dirname}/../Dockerfile`;
const dockerReadme = `${__dirname}/../docs/docker.md`;
const startScript = `${dockerFolder}/scripts/start.sh`;
const stopScript = `${dockerFolder}/scripts/stop.sh`;
const buildScript = `${dockerFolder}/scripts/build.sh`;
const releaseFolder = `${__dirname}/../release`;
const minimalEnv = `JWT_SECRET="${randomUUID().toString('hex').replace(/-/g, '')}}"
COOKIE_SECRET="${randomUUID().toString('hex').replace(/-/g, '')}"
SALT="${randomUUID().toString('hex').replace(/-/g, '')}}"
USER_LIMIT=1
DISABLE_REGISTRATION=0
OMDB_API_KEY=""`;

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

cpSync(distFolder, `${releaseVersionFolder}/dist`, { recursive: true });
cpSync(dockerFolder, `${releaseVersionFolder}/docker`, { recursive: true });
cpSync(dockerReadme, `${releaseVersionFolder}/README.md`);
cpSync(dockerFile, `${releaseVersionFolder}/Dockerfile`);
cpSync(startScript, `${releaseVersionFolder}/start.sh`);
cpSync(stopScript, `${releaseVersionFolder}/stop.sh`);
cpSync(buildScript, `${releaseVersionFolder}/build.sh`);
writeFileSync(`${releaseVersionFolder}/data/.env`, minimalEnv);

console.log(`Release created at ${releaseVersionFolder}`);
