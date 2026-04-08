import { FOLDERS } from '../main-const';
import { Store } from '../store/store';
import { StoreModel } from '../store/store-model';
import { getMemoryHash, hashFileExists, initializeFileHashes, removeFileHash, setFileHash } from './hash-util';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('hash-util', () => {
  const originalStorage = (global as any).__serverStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `hash-util-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.store, 'user'), { recursive: true });

    const store: StoreModel = {
      dataFolder: new BehaviorSubject<string | null>(tempDir),
      users: new BehaviorSubject(null),
      parserConfigs: new BehaviorSubject(null),
      tagConfigs: new BehaviorSubject(null),
      userSettings: new BehaviorSubject(null),
      cache: new BehaviorSubject<{ [key: string]: string }>({}),
      fileHashes: new BehaviorSubject<{ [key: string]: string }>({}),
    };
    (global as any).__serverStorage = store;
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    (global as any).__serverStorage = originalStorage;
  });

  describe('setFileHash', () => {
    it('writes a .hash sidecar file next to the target file', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      await setFileHash(storeFolder, 'user', 'file.md', 'hello world');

      const hashPath = path.join(storeFolder, 'file.md.hash');
      expect(existsSync(hashPath)).toBe(true);
      expect(readFileSync(hashPath, 'utf-8')).toMatch(/^[a-f0-9]+$/);
    });

    it('stores the hash in memory under the correct key', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      await setFileHash(storeFolder, 'user', 'file.md', 'hello world');

      expect(Store.getLastValue('fileHashes')['user-file.md']).toMatch(/^[a-f0-9]+$/);
    });

    it('returns the computed hash', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      const hash = await setFileHash(storeFolder, 'user', 'file.md', 'hello world');

      expect(hash).toMatch(/^[a-f0-9]+$/);
      expect(hash).toBe(Store.getLastValue('fileHashes')['user-file.md']);
    });

    it('produces the same hash for the same content', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      const hash1 = await setFileHash(storeFolder, 'user', 'file.md', 'same content');
      const hash2 = await setFileHash(storeFolder, 'user', 'file.md', 'same content');

      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different content', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      const hash1 = await setFileHash(storeFolder, 'user', 'a.md', 'content A');
      const hash2 = await setFileHash(storeFolder, 'user', 'b.md', 'content B');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getMemoryHash', () => {
    it('returns the hash stored in memory', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      const hash = await setFileHash(storeFolder, 'user', 'file.md', 'content');

      expect(getMemoryHash('user', 'file.md')).toBe(hash);
    });

    it('returns undefined when no hash has been set', () => {
      expect(getMemoryHash('user', 'nonexistent.md')).toBeUndefined();
    });
  });

  describe('hashFileExists', () => {
    it('returns true when a .hash sidecar file is present', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      await setFileHash(storeFolder, 'user', 'file.md', 'content');

      expect(hashFileExists(storeFolder, 'file.md')).toBe(true);
    });

    it('returns false when no .hash sidecar file exists', () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');

      expect(hashFileExists(storeFolder, 'missing.md')).toBe(false);
    });
  });

  describe('removeFileHash', () => {
    it('deletes the .hash sidecar file', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      await setFileHash(storeFolder, 'user', 'file.md', 'content');

      await removeFileHash(storeFolder, 'user', 'file.md');

      expect(existsSync(path.join(storeFolder, 'file.md.hash'))).toBe(false);
    });

    it('removes the hash from memory', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
      await setFileHash(storeFolder, 'user', 'file.md', 'content');

      await removeFileHash(storeFolder, 'user', 'file.md');

      expect(Store.getLastValue('fileHashes')['user-file.md']).toBeUndefined();
    });

    it('does not throw when the .hash file does not exist', async () => {
      const storeFolder = path.join(tempDir, FOLDERS.store, 'user');

      await expect(removeFileHash(storeFolder, 'user', 'nonexistent.md')).resolves.not.toThrow();
    });
  });

  describe('initializeFileHashes', () => {
    it('loads hashes from existing .hash files into memory', async () => {
      const userFolder = path.join(tempDir, FOLDERS.store, 'user');
      writeFileSync(path.join(userFolder, 'a.md'), 'content-a');
      writeFileSync(path.join(userFolder, 'a.md.hash'), 'precomputed-hash-a');

      await initializeFileHashes();

      expect(Store.getLastValue('fileHashes')['user-a.md']).toBe('precomputed-hash-a');
    });

    it('creates a missing .hash file and loads the computed hash', async () => {
      const userFolder = path.join(tempDir, FOLDERS.store, 'user');
      writeFileSync(path.join(userFolder, 'b.md'), 'content-b');

      await initializeFileHashes();

      const hashPath = path.join(userFolder, 'b.md.hash');
      expect(existsSync(hashPath)).toBe(true);
      const storedHash = readFileSync(hashPath, 'utf-8');
      expect(storedHash).toMatch(/^[a-f0-9]+$/);
      expect(Store.getLastValue('fileHashes')['user-b.md']).toBe(storedHash);
    });

    it('ignores .hash sidecar files when scanning for markdown files', async () => {
      const userFolder = path.join(tempDir, FOLDERS.store, 'user');
      writeFileSync(path.join(userFolder, 'a.md'), 'content');
      writeFileSync(path.join(userFolder, 'a.md.hash'), 'hash');

      await initializeFileHashes();

      const keys = Object.keys(Store.getLastValue('fileHashes'));
      expect(keys).toEqual(['user-a.md']);
    });

    it('handles multiple users and files', async () => {
      mkdirSync(path.join(tempDir, FOLDERS.store, 'user2'));
      const user1Folder = path.join(tempDir, FOLDERS.store, 'user');
      const user2Folder = path.join(tempDir, FOLDERS.store, 'user2');
      writeFileSync(path.join(user1Folder, 'x.md'), 'x-content');
      writeFileSync(path.join(user2Folder, 'y.md'), 'y-content');

      await initializeFileHashes();

      const hashes = Store.getLastValue('fileHashes');
      expect(hashes['user-x.md']).toMatch(/^[a-f0-9]+$/);
      expect(hashes['user2-y.md']).toMatch(/^[a-f0-9]+$/);
    });

    it('returns early without error when the store folder does not exist', async () => {
      rmSync(path.join(tempDir, FOLDERS.store), { recursive: true, force: true });

      await expect(initializeFileHashes()).resolves.not.toThrow();
      expect(Store.getLastValue('fileHashes')).toEqual({});
    });
  });
});
