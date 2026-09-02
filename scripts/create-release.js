#!/usr/bin/env node

const { createHash, randomUUID } = require('crypto');
const { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } = require('fs');
const { basename, join } = require('path');
const { spawnSync } = require('child_process');
const {
  assertVersionFilesMatch,
  getGitStatus,
  hasVersionTag,
  readPackageVersion,
  versionTag,
} = require('./bump-version');

const rootFolder = join(__dirname, '..');
const distFolder = join(rootFolder, 'dist');
const dockerFolder = join(rootFolder, 'docker');
const dockerFile = join(rootFolder, 'Dockerfile');
const dockerComposeFile = join(rootFolder, 'docker-compose.yml');
const dockerReadme = join(rootFolder, 'docs', 'docker.md');
const releaseFolder = join(rootFolder, 'release');
const clientAboutFile = join(rootFolder, 'apps', 'client', 'src', 'app', 'about', 'about.ts');
const androidFolder = join(rootFolder, 'android');
const androidReleaseApkFolder = join(androidFolder, 'app', 'build', 'outputs', 'apk', 'release');
const androidSdkBuildToolsFolder = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'build-tools')
  : '';
const helpHint = 'Run npm run release -- --help for usage.';

let appVersion = '';
let webReleaseName = '';
let webReleaseFolder = '';
let webZipFile = '';

const formatHelp = () => `Usage:
  npm run release -- [options]

Options:
  -h, --help                  Show this help.

Examples:
  npm run release
  npm run release -- --help
`;

const formatCommandPart = (part) => {
  if (/^[A-Za-z0-9_./:=@%+\\-]+$/.test(part)) return part;
  return `"${part.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

const formatCommand = (command, args = []) => [command, ...args].map(formatCommandPart).join(' ');

const createCommandFailureMessage = (command, args, cwd, status) => {
  const statusText = status === null || status === undefined ? 'unknown status' : `status ${status}`;
  return `Command failed with ${statusText}: ${formatCommand(command, args)}\nWorking directory: ${cwd}`;
};

const minimalEnv = `JWT_SECRET="${randomUUID().toString('hex').replace(/-/g, '')}"
COOKIE_SECRET="${randomUUID().toString('hex').replace(/-/g, '')}"
SALT="${randomUUID().toString('hex').replace(/-/g, '')}"
USER_LIMIT=1
DISABLE_REGISTRATION=0
OMDB_API_KEY=""`;

const parseArguments = (args = process.argv.slice(2)) => {
  const options = { help: false };

  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown release argument: ${arg}. ${helpHint}`);
  }

  return options;
};

const setReleasePaths = (version) => {
  appVersion = version;
  webReleaseName = `collection-tracker-${appVersion}`;
  webReleaseFolder = join(releaseFolder, webReleaseName);
  webZipFile = join(releaseFolder, `${webReleaseName}.zip`);
};

const getCommandOutput = (command, args) => {
  const cwd = rootFolder;
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(createCommandFailureMessage(command, args, cwd, result.status));
  return result.stdout.trim();
};

const replacePropertyValue = (source, property, value) => {
  const pattern = new RegExp(`protected readonly ${property} = '[^']*';`);
  if (!pattern.test(source)) throw new Error(`Could not find About ${property} build metadata placeholder.`);
  const escapedValue = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return source.replace(pattern, `protected readonly ${property} = '${escapedValue}';`);
};

const updateClientAboutBuildInfoSource = (aboutSource, { build, buildDate, version }, options = {}) => {
  const updatedAboutSource = replacePropertyValue(
    replacePropertyValue(replacePropertyValue(aboutSource, 'build', build), 'buildDate', buildDate),
    'appVersion',
    version
  );

  if (!options.allowUnchanged && updatedAboutSource === aboutSource) {
    throw new Error('Could not update release build metadata.');
  }

  return updatedAboutSource;
};

const formatBuildDate = (date = new Date()) => date.toISOString().slice(0, 10);

const getClientAboutReleaseBuildInfo = () => {
  const commitHash = getCommandOutput('git', ['rev-parse', '--short', 'HEAD']);
  const branch = getCommandOutput('git', ['name-rev', '--name-only', 'HEAD']);
  return {
    build: `${commitHash} (${branch})`,
    buildDate: formatBuildDate(),
    version: appVersion,
  };
};

const withClientAboutBuildInfo = (file, buildInfo, callback) => {
  const originalAboutSource = readFileSync(file, 'utf-8');
  writeFileSync(file, updateClientAboutBuildInfoSource(originalAboutSource, buildInfo), 'utf-8');

  try {
    return callback();
  } finally {
    writeFileSync(file, originalAboutSource, 'utf-8');
  }
};

const tagReleaseVersion = (version) => {
  const tag = versionTag(version);
  const status = getGitStatus();
  if (status) {
    console.warn(`Skipping git tag ${tag}: working tree is dirty.`);
    return;
  }
  if (hasVersionTag(version)) {
    console.log(`Git tag ${tag} already exists.`);
    return;
  }
  run('git', ['tag', tag], { label: `Tagging release ${tag}` });
};

const prepareVersion = () => {
  console.log('Preparing release version');
  const currentVersion = readPackageVersion();
  assertVersionFilesMatch(currentVersion);
  setReleasePaths(currentVersion);
};

const resolveApkSigner = () => {
  if (process.platform !== 'win32') return 'apksigner';
  if (!androidSdkBuildToolsFolder || !existsSync(androidSdkBuildToolsFolder)) return 'apksigner.bat';

  const versions = readdirSync(androidSdkBuildToolsFolder)
    .map((folder) => ({ folder, signer: join(androidSdkBuildToolsFolder, folder, 'apksigner.bat') }))
    .filter(({ signer }) => existsSync(signer))
    .sort((first, second) => second.folder.localeCompare(first.folder, undefined, { numeric: true }));

  return versions[0]?.signer ?? 'apksigner.bat';
};

const runNpmBuild = () => {
  if (process.platform === 'win32') {
    run('cmd', ['/d', '/s', '/c', 'npm.cmd', 'run', 'build'], { label: 'Building web apps' });
    return;
  }
  run('npm', ['run', 'build'], { label: 'Building web apps' });
};

const runApkSigner = (apkFile) => {
  const apkSigner = resolveApkSigner();
  const args = ['verify', '--verbose', apkFile];
  if (process.platform === 'win32' && apkSigner.endsWith('.bat')) {
    run('cmd', ['/d', '/s', '/c', apkSigner, ...args], { label: 'Verifying APK signature' });
    return;
  }
  run(apkSigner, args, { label: 'Verifying APK signature' });
};

const createZip = (sourceFolder, zipFile) => {
  if (existsSync(zipFile)) rmSync(zipFile, { force: true });
  if (process.platform === 'win32') {
    run(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -LiteralPath '${basename(sourceFolder).replaceAll("'", "''")}' -DestinationPath '${zipFile.replaceAll("'", "''")}' -Force`,
      ],
      { cwd: releaseFolder, label: 'Creating web archive' }
    );
    return;
  }
  run('zip', ['-r', zipFile, basename(sourceFolder)], { cwd: releaseFolder, label: 'Creating web archive' });
};

const writeHashFiles = (file) => {
  console.log(`Writing checksum files for ${basename(file)}`);
  const data = readFileSync(file);
  for (const algorithm of ['sha256', 'md5']) {
    const hash = createHash(algorithm).update(data).digest('hex');
    writeFileSync(`${file}.${algorithm}`, `${hash}  ${basename(file)}\n`);
  }
};

const run = (command, args, options = {}) => {
  const cwd = options.cwd ?? rootFolder;
  if (options.label) {
    console.log(`Running: ${options.label}`);
  }
  console.log(`Command: ${formatCommand(command, args)}`);

  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: options.shell ?? false,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(createCommandFailureMessage(command, args, cwd, result.status));
};

const recreateFolder = (folder) => {
  if (existsSync(folder)) {
    rmSync(folder, { recursive: true, force: true });
    console.log(`Removed folder: ${folder}`);
  }
  mkdirSync(folder, { recursive: true });
  console.log(`Created folder: ${folder}`);
};

const createWebRelease = () => {
  console.log('Copying web release files');
  recreateFolder(webReleaseFolder);
  mkdirSync(join(webReleaseFolder, 'data'), { recursive: true });

  cpSync(distFolder, join(webReleaseFolder, 'dist'), { recursive: true });
  cpSync(dockerFolder, join(webReleaseFolder, 'docker'), { recursive: true });
  cpSync(dockerReadme, join(webReleaseFolder, 'README.md'));
  cpSync(dockerFile, join(webReleaseFolder, 'Dockerfile'));
  cpSync(dockerComposeFile, join(webReleaseFolder, 'docker-compose.yml'));
  writeFileSync(join(webReleaseFolder, 'data', '.env'), minimalEnv);
};

const findAndroidApks = () => {
  if (!existsSync(androidReleaseApkFolder)) return [];
  return readdirSync(androidReleaseApkFolder)
    .filter((file) => file.endsWith('.apk'))
    .map((file) => join(androidReleaseApkFolder, file));
};

const createAndroidRelease = () => {
  console.log('Building Android release');
  if (existsSync(androidReleaseApkFolder)) {
    rmSync(androidReleaseApkFolder, { recursive: true, force: true });
  }

  const androidCommand = process.platform === 'win32' ? 'cmd' : './gradlew';
  const androidArgs =
    process.platform === 'win32' ? ['/c', join(androidFolder, 'gradlew.bat'), 'assembleRelease'] : ['assembleRelease'];
  run(androidCommand, androidArgs, { cwd: androidFolder, label: 'Building Android release APK' });

  const apkFiles = findAndroidApks();
  if (!apkFiles.length) {
    throw new Error(`No Android APK files found in ${androidReleaseApkFolder} after assembleRelease.`);
  }

  let copiedApk = '';
  for (const apkFile of apkFiles) {
    const isUnsigned = basename(apkFile).includes('unsigned');
    const releaseApk = join(releaseFolder, `collection-tracker-${appVersion}${isUnsigned ? '-unsigned' : ''}.apk`);
    cpSync(apkFile, releaseApk);
    if (!isUnsigned) {
      runApkSigner(releaseApk);
    } else {
      console.warn(`Skipping signature verification for unsigned APK: ${releaseApk}`);
    }
    writeHashFiles(releaseApk);
    copiedApk = releaseApk;
  }

  writeFileSync(
    join(releaseFolder, `collection-tracker-${appVersion}-android.txt`),
    `# Collection Tracker Android ${appVersion}

APK artifact: \`${basename(copiedApk)}\`

This is a release APK artifact built from the Android wrapper with \`assembleRelease\`.
Set \`ANDROID_KEYSTORE_PATH\`, \`ANDROID_KEYSTORE_PASSWORD\`, \`ANDROID_KEY_ALIAS\`, and \`ANDROID_KEY_PASSWORD\` before running the release script to produce signed APKs.
If an APK filename contains \`unsigned\`, sign it with your Android release key before distribution.
`
  );
};

const createRelease = () => {
  const options = parseArguments();
  if (options.help) {
    console.log(formatHelp());
    return;
  }

  prepareVersion();
  withClientAboutBuildInfo(clientAboutFile, getClientAboutReleaseBuildInfo(), runNpmBuild);
  console.log('Staging release folder');
  recreateFolder(releaseFolder);
  createWebRelease();
  createAndroidRelease();
  createZip(webReleaseFolder, webZipFile);
  writeHashFiles(webZipFile);
  tagReleaseVersion(appVersion);

  console.log(`Web release created at ${webReleaseFolder}`);
  console.log(`Web archive created at ${webZipFile}`);
};

if (require.main === module) {
  try {
    createRelease();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  createCommandFailureMessage,
  formatBuildDate,
  formatCommand,
  formatHelp,
  parseArguments,
  updateClientAboutBuildInfoSource,
  withClientAboutBuildInfo,
};
