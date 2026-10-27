const { createHash } = require('node:crypto');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const readAssets = (artifactDir) => {
  const names = readdirSync(artifactDir).filter((name) => /\.(apk|zip)$/.test(name));
  if (
    names.length !== 2 ||
    !names.some((name) => name.endsWith('.apk')) ||
    !names.some((name) => name.endsWith('.zip')) ||
    names.some((name) => name.includes('unsigned'))
  ) {
    throw new Error('Expected one signed APK and one web ZIP');
  }
  return [...names, 'android-update.json'].flatMap((name) => {
    const data = readFileSync(join(artifactDir, name));
    const checksums = ['sha256', 'md5'].map((algorithm) => {
      const checksumName = `${name}.${algorithm}`;
      const checksum = readFileSync(join(artifactDir, checksumName));
      const expected = `${createHash(algorithm).update(data).digest('hex')}  ${name}`;
      if (checksum.toString().trim() !== expected) throw new Error(`Invalid checksum: ${checksumName}`);
      return { name: checksumName, data: checksum };
    });
    return [{ name, data }, ...checksums];
  });
};

async function publish({ github, context, core, artifactDir, tag, sha, branch }) {
  if (!/^[a-f0-9]{40}$/.test(sha) || (tag !== 'snapshot' && !/^v\d+\.\d+\.\d+$/.test(tag))) {
    throw new Error('Invalid release SHA or tag');
  }
  const repo = context.repo;
  const snapshot = tag === 'snapshot';
  const suffix = `${context.runId}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`;
  const stagingTag = `snapshot-staging-${suffix}`;
  const backupTag = `snapshot-backup-${suffix}`;
  const api = github.rest;
  const optional = async (call) => {
    try {
      return (await call()).data;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  };
  const isCurrent = async () => (await api.repos.getBranch({ ...repo, branch })).data.commit.sha === sha;
  if (!(await isCurrent())) {
    core.notice('Superseded build; keeping previous release.');
    return;
  }
  const existing = await optional(() => api.repos.getReleaseByTag({ ...repo, tag }));
  const oldRef = snapshot ? await optional(() => api.git.getRef({ ...repo, ref: 'tags/snapshot' })) : null;
  if (existing && !existing.draft && (!snapshot || oldRef?.object.sha === sha)) {
    core.notice(`${tag} already published; skipping duplicate completion or rerun.`);
    return;
  }
  if (existing?.draft) throw new Error(`Existing ${tag} draft needs recovery before retrying`);
  const files = readAssets(artifactDir);
  const metadata = JSON.parse(files.find((file) => file.name === 'android-update.json').data.toString());
  if (
    metadata.schema !== 1 ||
    metadata.commit !== sha ||
    metadata.channel !== (snapshot ? 'snapshot' : 'release') ||
    !/^\d+\.\d+\.\d+$/.test(metadata.version) ||
    (!snapshot && tag !== `v${metadata.version}`) ||
    !Number.isSafeInteger(metadata.commitTime) ||
    metadata.commitTime <= 0 ||
    !Number.isInteger(metadata.versionCode) ||
    metadata.versionCode <= 0 ||
    metadata.versionCode > 2100000000
  )
    throw new Error('Invalid Android update metadata');
  const runUrl = `${context.serverUrl || 'https://github.com'}/${repo.owner}/${repo.repo}/actions/runs/${context.runId}`;
  const notes = snapshot
    ? `Development snapshot from ${branch}.\n\nCommit: ${sha}\nBuilt: ${new Date().toISOString()}\nBuild and checks: ${runUrl}\n\nIncludes a signed Android APK, web/server ZIP, and SHA-256 and MD5 checksums. This prerelease is replaced by the next successful build.`
    : (await api.repos.generateReleaseNotes({ ...repo, tag_name: tag, target_commitish: sha })).data.body;
  let staged,
    archived = false,
    moved = false,
    published = false,
    recoveryFailed = false;
  const previousDraft = existing?.draft;
  try {
    staged = (
      await api.repos.createRelease({
        ...repo,
        tag_name: snapshot ? stagingTag : tag,
        target_commitish: sha,
        name: snapshot ? 'Development snapshot' : tag,
        body: `${notes}\n\n<!-- collection-tracker-android:${JSON.stringify(metadata)} -->`,
        draft: true,
        prerelease: snapshot,
        make_latest: 'false',
      })
    ).data;
    for (const file of files) {
      const uploaded = await api.repos.uploadReleaseAsset({
        ...repo,
        release_id: staged.id,
        name: file.name,
        data: file.data,
        headers: { 'content-type': 'application/octet-stream', 'content-length': file.data.length },
      });
      if (uploaded.data.size !== file.data.length) throw new Error(`Incomplete upload: ${file.name}`);
    }
    if (!(await isCurrent())) {
      core.notice('Branch advanced during upload; keeping previous release.');
      return;
    }
    if (snapshot) {
      // Keep previous assets recoverable until the replacement is public.
      if (existing) {
        archived = true;
        await api.repos.updateRelease({ ...repo, release_id: existing.id, tag_name: backupTag, draft: true });
      }
      moved = true;
      if (oldRef) await api.git.updateRef({ ...repo, ref: 'tags/snapshot', sha, force: true });
      else await api.git.createRef({ ...repo, ref: 'refs/tags/snapshot', sha });
    }
    await api.repos.updateRelease({
      ...repo,
      release_id: staged.id,
      tag_name: tag,
      draft: false,
      prerelease: snapshot,
      make_latest: snapshot ? 'false' : 'legacy',
    });
    published = true;
    core.notice(`Published ${tag} from ${sha}`);
  } catch (error) {
    if (snapshot && !published) {
      const recover = async (task) => {
        try {
          await task();
          return true;
        } catch (rollbackError) {
          recoveryFailed = true;
          core.warning(`Snapshot recovery needs attention (${backupTag}): ${rollbackError.message}`);
        }
      };
      if (staged)
        await recover(async () => {
          await api.repos.deleteRelease({ ...repo, release_id: staged.id });
          staged = null;
        });
      const refRestored =
        !moved ||
        (await recover(() =>
          oldRef
            ? api.git.updateRef({ ...repo, ref: 'tags/snapshot', sha: oldRef.object.sha, force: true })
            : optional(() => api.git.deleteRef({ ...repo, ref: 'tags/snapshot' }))
        ));
      if (archived && refRestored)
        await recover(() =>
          api.repos.updateRelease({
            ...repo,
            release_id: existing.id,
            tag_name: 'snapshot',
            draft: previousDraft,
            prerelease: true,
            make_latest: 'false',
          })
        );
    }
    throw error;
  } finally {
    // Cleanup failures must not undo a successful publication or destroy recovery data.
    try {
      if (staged && !published) await api.repos.deleteRelease({ ...repo, release_id: staged.id });
      if (snapshot && published && existing) await api.repos.deleteRelease({ ...repo, release_id: existing.id });
      if (snapshot && !recoveryFailed)
        for (const temporaryTag of [stagingTag, backupTag]) {
          try {
            await api.git.deleteRef({ ...repo, ref: `tags/${temporaryTag}` });
          } catch (error) {
            const absent =
              error.status === 404 ||
              (error.status === 422 && error.response?.data?.message === 'Reference does not exist');
            if (!absent) core.warning(`Release cleanup needs attention for ${temporaryTag}: ${error.message}`);
          }
        }
    } catch (error) {
      core.warning(`Release cleanup needs attention: ${error.message}`);
    }
  }
}

module.exports = { publish, readAssets };
