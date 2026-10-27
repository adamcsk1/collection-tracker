import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { publish, readAssets } = createRequire(import.meta.url)('./publish-release.js');
const sha = 'a'.repeat(40);
const previousSha = 'b'.repeat(40);
const folders = [];
function writeMetadata(folder, channel = 'snapshot', overrides = {}) {
  const name = 'android-update.json';
  const data = JSON.stringify({
    schema: 1,
    channel,
    version: '1.2.3',
    commit: sha,
    commitTime: 1790000000,
    versionCode: 895000000,
    ...overrides,
  });
  writeFileSync(join(folder, name), data);
  for (const algorithm of ['sha256', 'md5']) {
    writeFileSync(
      join(folder, `${name}.${algorithm}`),
      `${createHash(algorithm).update(data).digest('hex')}  ${name}\n`
    );
  }
}
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));

function fixture({ existing = true, tag = 'snapshot' } = {}) {
  const artifactDir = mkdtempSync(join(tmpdir(), 'collection-publisher-'));
  folders.push(artifactDir);
  writeMetadata(artifactDir, tag === 'snapshot' ? 'snapshot' : 'release');
  for (const name of ['collection-tracker-snapshot.apk', 'collection-tracker-snapshot.zip']) {
    writeFileSync(join(artifactDir, name), 'binary');
    for (const algorithm of ['sha256', 'md5']) {
      writeFileSync(
        join(artifactDir, `${name}.${algorithm}`),
        `${createHash(algorithm).update('binary').digest('hex')}  ${name}\n`
      );
    }
  }
  const releases = new Map(existing ? [[1, { id: 1, tag_name: 'snapshot', draft: false, assets: ['old'] }]] : []);
  const refs = new Map(existing ? [['tags/snapshot', { object: { sha: previousSha } }]] : []);
  const missing = () => {
    throw Object.assign(new Error('Not found'), { status: 404 });
  };
  let nextId = 2;
  const repos = {
    getBranch: vi.fn(async () => ({ data: { commit: { sha } } })),
    getReleaseByTag: vi.fn(async ({ tag: name }) => ({
      data: [...releases.values()].find((release) => release.tag_name === name) || missing(),
    })),
    generateReleaseNotes: vi.fn(async () => ({ data: { body: 'Stable notes' } })),
    createRelease: vi.fn(async (values) => {
      const release = { ...values, id: nextId++, assets: [] };
      releases.set(release.id, release);
      return { data: release };
    }),
    uploadReleaseAsset: vi.fn(async ({ release_id, name, data }) => {
      releases.get(release_id).assets.push(name);
      return { data: { size: data.length } };
    }),
    updateRelease: vi.fn(async ({ release_id, ...values }) => {
      Object.assign(releases.get(release_id), values);
      return { data: releases.get(release_id) };
    }),
    deleteRelease: vi.fn(async ({ release_id }) => {
      releases.delete(release_id);
    }),
  };
  const git = {
    getRef: vi.fn(async ({ ref }) => ({ data: refs.get(ref) || missing() })),
    createRef: vi.fn(async ({ ref, sha: commit }) => {
      refs.set(ref.replace(/^refs\//, ''), { object: { sha: commit } });
    }),
    updateRef: vi.fn(async ({ ref, sha: commit }) => {
      refs.set(ref, { object: { sha: commit } });
    }),
    deleteRef: vi.fn(async ({ ref }) => {
      if (!refs.delete(ref)) missing();
    }),
  };
  const core = { notice: vi.fn(), warning: vi.fn() };
  return {
    releases,
    refs,
    repos,
    git,
    core,
    options: {
      github: { rest: { repos, git } },
      core,
      artifactDir,
      tag,
      sha,
      branch: 'main',
      context: {
        repo: { owner: 'test', repo: 'collection-tracker' },
        sha: 'wrong-context-sha',
        ref: 'refs/heads/other',
        runId: 42,
      },
    },
  };
}

describe('release publisher', () => {
  it.each([{ commit: previousSha }, { channel: 'release' }, { versionCode: -1 }, { commitTime: 0 }, { schema: 2 }])(
    'rejects mismatched metadata before staging: %j',
    async (overrides) => {
      const state = fixture();
      writeMetadata(state.options.artifactDir, 'snapshot', overrides);
      await expect(publish(state.options)).rejects.toThrow('Invalid Android update metadata');
      expect(state.repos.createRelease).not.toHaveBeenCalled();
    }
  );
  it('stages all nine verified assets before replacing snapshot using explicit SHA', async () => {
    const state = fixture();
    const upload = state.repos.uploadReleaseAsset.getMockImplementation();
    state.repos.uploadReleaseAsset.mockImplementation(async (values) => {
      expect(state.releases.get(1).draft).toBe(false);
      expect(state.refs.get('tags/snapshot').object.sha).toBe(previousSha);
      return upload(values);
    });
    await publish(state.options);
    expect(state.releases.size).toBe(1);
    const release = [...state.releases.values()][0];
    expect(release).toMatchObject({
      tag_name: 'snapshot',
      draft: false,
      prerelease: true,
      make_latest: 'false',
      target_commitish: sha,
    });
    expect(release.assets).toHaveLength(9);
    expect(release.body).toContain('<!-- collection-tracker-android:');
    expect(release.body).toContain(sha);
    expect(release.body).toContain('/actions/runs/42');
    expect(release.body).toContain('Built:');
    expect(state.refs.get('tags/snapshot').object.sha).toBe(sha);
    await publish(state.options);
    expect(state.repos.createRelease).toHaveBeenCalledTimes(1);
  });

  it('creates first snapshot and never overwrites an existing stable release', async () => {
    const state = fixture({ existing: false });
    await publish(state.options);
    expect(state.refs.get('tags/snapshot').object.sha).toBe(sha);
    state.options.tag = 'v1.2.3';
    writeMetadata(state.options.artifactDir, 'release');
    await publish(state.options);
    await publish(state.options);
    expect(state.repos.createRelease).toHaveBeenCalledTimes(2);
    expect([...state.releases.values()].find((release) => release.tag_name === 'v1.2.3')).toMatchObject({
      prerelease: false,
      make_latest: 'legacy',
    });
    expect(state.refs.get('tags/snapshot').object.sha).toBe(sha);
  });

  it.each([false, true])('skips superseded builds (during upload: %s)', async (duringUpload) => {
    const state = fixture();
    if (duringUpload) state.repos.getBranch.mockResolvedValueOnce({ data: { commit: { sha } } });
    state.repos.getBranch.mockResolvedValue({ data: { commit: { sha: previousSha } } });
    await publish(state.options);
    expect(state.releases.size).toBe(1);
    expect(state.releases.get(1).draft).toBe(false);
    expect(state.git.updateRef).not.toHaveBeenCalled();
  });

  it.each(['upload', 'metadataUpload', 'incomplete', 'archive', 'tag', 'publish'])(
    'restores previous snapshot after %s failure',
    async (failure) => {
      const state = fixture();
      if (failure === 'upload') state.repos.uploadReleaseAsset.mockRejectedValueOnce(new Error('failed'));
      if (failure === 'metadataUpload') {
        const upload = state.repos.uploadReleaseAsset.getMockImplementation();
        state.repos.uploadReleaseAsset.mockImplementation(async (values) => {
          if (values.name === 'android-update.json') throw new Error('metadata upload failed');
          return upload(values);
        });
      }
      if (failure === 'incomplete') state.repos.uploadReleaseAsset.mockResolvedValueOnce({ data: { size: 0 } });
      if (failure === 'archive' || failure === 'publish') {
        const update = state.repos.updateRelease.getMockImplementation();
        state.repos.updateRelease.mockImplementation(async (values) => {
          const result = await update(values);
          if (
            (failure === 'archive' && values.tag_name.startsWith('snapshot-backup')) ||
            (failure === 'publish' && values.release_id !== 1 && !values.draft)
          )
            throw new Error('response lost');
          return result;
        });
      }
      if (failure === 'tag') {
        const update = state.git.updateRef.getMockImplementation();
        state.git.updateRef.mockImplementationOnce(async (values) => {
          await update(values);
          throw new Error('response lost');
        });
      }
      await expect(publish(state.options)).rejects.toThrow();
      expect(state.releases.size).toBe(1);
      expect(state.releases.get(1)).toMatchObject({ tag_name: 'snapshot', draft: false, assets: ['old'] });
      expect(state.refs.get('tags/snapshot').object.sha).toBe(previousSha);
    }
  );

  it('removes first snapshot tag when publication fails', async () => {
    const state = fixture({ existing: false });
    state.repos.updateRelease.mockRejectedValueOnce(new Error('failed'));
    await expect(publish(state.options)).rejects.toThrow('failed');
    expect(state.releases.size).toBe(0);
    expect(state.refs.has('tags/snapshot')).toBe(false);
  });

  it('retains backup and warns when rollback fails', async () => {
    const state = fixture();
    const update = state.repos.updateRelease.getMockImplementation();
    state.repos.updateRelease.mockImplementation(async (values) => {
      if (values.draft === false) throw new Error('API unavailable');
      return update(values);
    });
    await expect(publish(state.options)).rejects.toThrow();
    expect(state.releases.get(1).tag_name).toContain('snapshot-backup-');
    expect(state.releases.get(1).assets).toEqual(['old']);
    expect(state.core.warning).toHaveBeenCalledWith(expect.stringContaining('recovery needs attention'));
    expect(state.git.deleteRef).not.toHaveBeenCalled();
  });

  it('cleanup failure does not undo publication', async () => {
    const state = fixture();
    state.repos.deleteRelease.mockRejectedValue(new Error('cleanup failed'));
    await publish(state.options);
    expect(state.refs.get('tags/snapshot').object.sha).toBe(sha);
    expect(state.core.warning).toHaveBeenCalledWith(expect.stringContaining('cleanup needs attention'));
  });

  it('keeps old assets in the backup draft when publication and ref rollback fail', async () => {
    const state = fixture();
    const updateRelease = state.repos.updateRelease.getMockImplementation();
    state.repos.updateRelease.mockImplementation(async (values) => {
      if (values.release_id !== 1 && values.draft === false) throw new Error('Publication failed');
      return updateRelease(values);
    });
    const updateRef = state.git.updateRef.getMockImplementation();
    state.git.updateRef.mockImplementation(async (values) => {
      if (values.sha === previousSha) throw new Error('Ref rollback failed');
      return updateRef(values);
    });

    await expect(publish(state.options)).rejects.toThrow('Publication failed');

    expect(state.refs.get('tags/snapshot').object.sha).toBe(sha);
    expect(state.releases.size).toBe(1);
    expect(state.releases.get(1)).toMatchObject({
      tag_name: expect.stringContaining('snapshot-backup-'),
      draft: true,
      assets: ['old'],
    });
    expect(state.repos.updateRelease).not.toHaveBeenCalledWith(
      expect.objectContaining({ release_id: 1, tag_name: 'snapshot' })
    );
    expect(state.core.warning).toHaveBeenCalledWith(expect.stringContaining('Ref rollback failed'));
    expect(state.git.deleteRef).not.toHaveBeenCalled();
  });

  it('rejects missing or corrupt checksums and unsigned APKs before mutation', async () => {
    const state = fixture();
    writeFileSync(join(state.options.artifactDir, 'collection-tracker-snapshot.apk.sha256'), 'bad');
    await expect(publish(state.options)).rejects.toThrow('Invalid checksum');
    expect(state.repos.createRelease).not.toHaveBeenCalled();
    rmSync(join(state.options.artifactDir, 'collection-tracker-snapshot.apk.sha256'));
    expect(() => readAssets(state.options.artifactDir)).toThrow();
    writeFileSync(join(state.options.artifactDir, 'extra-unsigned.apk'), 'unsigned');
    expect(() => readAssets(state.options.artifactDir)).toThrow('signed APK');
  });
});
