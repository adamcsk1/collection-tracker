#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const rootFolder = join(__dirname, '..');
const packageJsonFile = join(rootFolder, 'package.json');
const packageLockFile = join(rootFolder, 'package-lock.json');
const androidBuildFile = join(rootFolder, 'android', 'app', 'build.gradle.kts');
const helpHint = 'Run npm run bump-version -- --help for usage.';

const formatHelp = () => `Usage:
  npm run bump-version -- <major|minor|patch> [options]

Options:
  --no-commit                 Do not commit the version bump.
  -h, --help                  Show this help.

Examples:
  npm run bump-version -- patch
  npm run bump-version -- minor --no-commit
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

const parseArguments = (args = process.argv.slice(2)) => {
  const options = { bump: '', help: false, noCommit: false };

  for (const arg of args) {
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--no-commit') {
      options.noCommit = true;
      continue;
    }
    if (['major', 'minor', 'patch'].includes(arg)) {
      if (options.bump) throw new Error(`Unknown bump-version argument: ${arg}. ${helpHint}`);
      options.bump = arg;
      continue;
    }
    throw new Error(`Unknown bump-version argument: ${arg}. ${helpHint}`);
  }

  if (options.help) return options;
  if (!options.bump) throw new Error(`Bump type is required: major, minor, or patch. ${helpHint}`);

  return options;
};

const readJsonFile = (file) => JSON.parse(readFileSync(file, 'utf-8'));

const writeJsonFile = (file, data) => {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const readPackageVersion = () => readJsonFile(packageJsonFile).version;

const bumpVersion = (version, bump) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Cannot bump non-semver version: ${version}`);

  const [, majorValue, minorValue, patchValue] = match;
  let major = Number(majorValue);
  let minor = Number(minorValue);
  let patch = Number(patchValue);

  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
};

const versionTag = (version) => `v${version}`;

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

const getGitStatus = () => {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: rootFolder,
    encoding: 'utf-8',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(createCommandFailureMessage('git', ['status', '--porcelain'], rootFolder, result.status));
  return result.stdout.trim();
};

const assertCleanGitStatus = () => {
  const status = getGitStatus();
  if (status) {
    throw new Error(
      `Cannot create a version bump commit with a dirty git status. Commit or stash changes first, or use --no-commit.\n${status}`
    );
  }
};

const hasVersionTag = (version) => {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${versionTag(version)}`], {
    cwd: rootFolder,
    shell: false,
    stdio: 'ignore',
  });
  if (result.error) throw result.error;
  return result.status === 0;
};

const assertVersionTagMissing = (version) => {
  if (hasVersionTag(version)) throw new Error(`Git tag ${versionTag(version)} already exists.`);
};

const updateVersionFiles = (version) => {
  console.log(`Updating version files to ${version}`);

  const packageJson = readJsonFile(packageJsonFile);
  packageJson.version = version;
  writeJsonFile(packageJsonFile, packageJson);

  const packageLock = readJsonFile(packageLockFile);
  packageLock.version = version;
  packageLock.packages[''].version = version;
  writeJsonFile(packageLockFile, packageLock);

  const androidBuild = readFileSync(androidBuildFile, 'utf-8');
  const updatedAndroidBuild = androidBuild.replace(/versionName = "\d+\.\d+\.\d+"/, `versionName = "${version}"`);
  if (updatedAndroidBuild === androidBuild)
    throw new Error(`Could not update Android versionName in ${androidBuildFile}`);
  writeFileSync(androidBuildFile, updatedAndroidBuild);
};

const getVersionFromFile = (file, pattern, label) => {
  const match = pattern.exec(readFileSync(file, 'utf-8'));
  if (!match) throw new Error(`Could not read ${label} version from ${file}`);
  return match[1];
};

const assertVersionFilesMatch = (version) => {
  const packageLock = readJsonFile(packageLockFile);
  const versions = [
    ['package-lock.json', packageLock.version],
    ['package-lock.json packages root', packageLock.packages[''].version],
    ['Android versionName', getVersionFromFile(androidBuildFile, /versionName = "(\d+\.\d+\.\d+)"/, 'Android')],
  ];

  for (const [label, foundVersion] of versions) {
    if (foundVersion !== version) {
      throw new Error(
        `${label} version ${foundVersion} does not match package.json version ${version}. Run npm run bump-version or update versions before packaging.`
      );
    }
  }
};

const commitVersionBump = (version) => {
  run('git', ['add', packageJsonFile, packageLockFile, androidBuildFile], { label: 'Staging version bump files' });
  run('git', ['commit', '-m', `chore(release): bump version to ${version}`], { label: 'Committing version bump' });
};

const bumpReleaseVersion = () => {
  const options = parseArguments();
  if (options.help) {
    console.log(formatHelp());
    return;
  }

  const currentVersion = readPackageVersion();
  if (!options.noCommit) assertCleanGitStatus();

  const nextVersion = bumpVersion(currentVersion, options.bump);
  if (!options.noCommit) assertVersionTagMissing(nextVersion);
  updateVersionFiles(nextVersion);
  console.log(`Version bumped from ${currentVersion} to ${nextVersion}`);

  if (!options.noCommit) commitVersionBump(nextVersion);
};

if (require.main === module) {
  try {
    bumpReleaseVersion();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  assertVersionFilesMatch,
  bumpVersion,
  formatHelp,
  getGitStatus,
  hasVersionTag,
  parseArguments,
  readPackageVersion,
  versionTag,
};
