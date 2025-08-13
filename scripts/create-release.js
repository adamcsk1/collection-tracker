const { mkdirSync, existsSync, cpSync, rmSync, readFileSync } = require('fs');

const distFolder = `${__dirname}/../dist`;
const dockerFolder = `${__dirname}/../docker`;
const dockerFile = `${__dirname}/../Dockerfile`;
const releaseFolder = `${__dirname}/../release`;

if (!existsSync(releaseFolder)) mkdirSync(releaseFolder);

const appVersion = JSON.parse(readFileSync(`${__dirname}/../package.json`, 'utf-8')).version;

const releaseVersionFolder = `${releaseFolder}/release-${appVersion}`;

if (existsSync(releaseVersionFolder)) {
  rmSync(releaseVersionFolder, { recursive: true, force: true });
}

mkdirSync(releaseVersionFolder, { recursive: true });

cpSync(distFolder, `${releaseVersionFolder}/dist`, { recursive: true });
cpSync(dockerFolder, `${releaseVersionFolder}/docker`, { recursive: true });
cpSync(dockerFile, `${releaseVersionFolder}/Dockerfile`);
