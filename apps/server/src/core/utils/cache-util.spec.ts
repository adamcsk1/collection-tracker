import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { StoreModel } from '@server/core/store/store-model';
import { CACHE_MAX, readStoreFiles, removeItem, updateItem } from '@server/core/utils/cache-util';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, stat: vi.fn() };
});

describe('cache-util', () => {
  const originalStorage = (global as any).__serverStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `cache-util-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.store, 'notes'), { recursive: true });

    const store: StoreModel = {
      dataFolder: new BehaviorSubject<string | null>(tempDir),
      users: new BehaviorSubject(null),
      parserConfigs: new BehaviorSubject(null),
      tagConfigs: new BehaviorSubject(null),
      userSettings: new BehaviorSubject(null),
      cache: new BehaviorSubject<{ [key: string]: string; }>({}),
    };

    (global as any).__serverStorage = store;
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    (global as any).__serverStorage = originalStorage;
  });

  it('updates file contents and cache when updating an item', async () => {
    const storeSetSpy = vi.spyOn(Store, 'set');

    await updateItem('file.txt', 'notes', 'hello');

    const filePath = path.join(tempDir, FOLDERS.store, 'notes', 'file.txt');
    expect(readFileSync(filePath, { encoding: 'utf-8' })).toBe('hello');
    expect(Store.getLastValue('cache')).toEqual({ 'notes-file.txt': 'hello' });
    expect(storeSetSpy).toHaveBeenCalledWith('cache', { 'notes-file.txt': 'hello' });
  });

  it('evicts oldest entries when cache exceeds CACHE_MAX on update', async () => {
    const initialCache: Record<string, string> = {};
    for (let i = 0; i < CACHE_MAX; i++) {
      initialCache[`notes-old${i}.txt`] = `content-${i}`;
    }
    Store.set('cache', initialCache);

    await updateItem('new-file.txt', 'notes', 'new content');

    const cache = Store.getLastValue('cache');
    expect(Object.keys(cache).length).toBe(CACHE_MAX);
    expect(cache['notes-old0.txt']).toBeUndefined();
    expect(cache['notes-new-file.txt']).toBe('new content');
  });

  it('promotes updated entry to MRU so it survives the next eviction', async () => {
    const initialCache: Record<string, string> = {};
    for (let i = 0; i < CACHE_MAX; i++) {
      initialCache[`notes-old${i}.txt`] = `content-${i}`;
    }
    Store.set('cache', initialCache);

    // Update 'old0' (the oldest) — this promotes it to MRU
    await updateItem('old0.txt', 'notes', 'updated');
    // Add a brand-new entry — pushes total to CACHE_MAX+1, triggering eviction
    // The new oldest is now 'old1', not 'old0'
    await updateItem('new-file.txt', 'notes', 'new content');

    const cache = Store.getLastValue('cache');
    expect(Object.keys(cache).length).toBe(CACHE_MAX);
    expect(cache['notes-old0.txt']).toBe('updated'); // promoted, survived eviction
    expect(cache['notes-old1.txt']).toBeUndefined(); // became the new oldest, evicted
    expect(cache['notes-new-file.txt']).toBe('new content');
  });

  it('removes file and cache entry when removing an item', async () => {
    const filePath = path.join(tempDir, FOLDERS.store, 'notes', 'file.txt');
    writeFileSync(filePath, 'to delete');
    Store.set('cache', { 'notes-file.txt': 'cached' });
    const storeSetSpy = vi.spyOn(Store, 'set');

    await removeItem('file.txt', 'notes');

    expect(existsSync(filePath)).toBe(false);
    expect(Store.getLastValue('cache')).toEqual({});
    expect(storeSetSpy).toHaveBeenCalledWith('cache', {});
  });
});

describe('readStoreFiles', () => {
  const originalStorage = (global as any).__serverStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `read-store-files-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.store, 'user'), { recursive: true });

    const store: StoreModel = {
      dataFolder: new BehaviorSubject<string | null>(tempDir),
      users: new BehaviorSubject(null),
      parserConfigs: new BehaviorSubject(null),
      tagConfigs: new BehaviorSubject(null),
      userSettings: new BehaviorSubject(null),
      cache: new BehaviorSubject<{ [key: string]: string; }>({}),
    };
    (global as any).__serverStorage = store;
    (stat as Mock).mockResolvedValue({ birthtimeMs: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    (global as any).__serverStorage = originalStorage;
  });

  it('returns all files with content when called without offset or limit', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'a.txt'), 'content-a');
    writeFileSync(path.join(storeFolder, 'b.txt'), 'content-b');

    const result = await readStoreFiles(storeFolder, 'user');

    expect(result).toHaveLength(2);
    expect(result.map((file) => file.name)).toContain('a.txt');
    expect(result.map((file) => file.name)).toContain('b.txt');
    expect(result.find((file) => file.name === 'a.txt')?.content).toBe('content-a');
    expect(result.find((file) => file.name === 'b.txt')?.content).toBe('content-b');
  });

  it('sorts files by birth time descending', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'old.txt'), 'old');
    writeFileSync(path.join(storeFolder, 'new.txt'), 'new');

    (stat as Mock).mockImplementation((filePath: string) => {
      const name = path.basename(filePath);
      return Promise.resolve({ birthtimeMs: name === 'new.txt' ? 2000 : 1000 });
    });

    const result = await readStoreFiles(storeFolder, 'user');

    expect(result[0].name).toBe('new.txt');
    expect(result[1].name).toBe('old.txt');
  });

  it('uses filename as descending tiebreaker when birth times are equal', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'aaa.txt'), 'a');
    writeFileSync(path.join(storeFolder, 'zzz.txt'), 'z');
    // stat mocked to return birthtimeMs: 0 for all files in beforeEach

    const result = await readStoreFiles(storeFolder, 'user');

    expect(result[0].name).toBe('zzz.txt');
    expect(result[1].name).toBe('aaa.txt');
  });

  it('returns paginated slice when offset and limit are provided', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'file1.txt'), 'content1');
    writeFileSync(path.join(storeFolder, 'file2.txt'), 'content2');
    writeFileSync(path.join(storeFolder, 'file3.txt'), 'content3');

    (stat as Mock).mockImplementation((filePath: string) => {
      const name = path.basename(filePath);
      const birthtimeMs = name === 'file1.txt' ? 3000 : name === 'file2.txt' ? 2000 : 1000;
      return Promise.resolve({ birthtimeMs });
    });

    const result = await readStoreFiles(storeFolder, 'user', 1, 1);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('file2.txt');
    expect(result[0].content).toBe('content2');
  });

  it('reads content from cache when cache entry exists', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'file.txt'), 'disk content');
    Store.set('cache', { 'user-file.txt': 'cached content' });

    const result = await readStoreFiles(storeFolder, 'user');

    expect(result[0].content).toBe('cached content');
  });

  it('populates cache with file content on first read', async () => {
    const storeFolder = path.join(tempDir, FOLDERS.store, 'user');
    writeFileSync(path.join(storeFolder, 'file.txt'), 'fresh content');

    await readStoreFiles(storeFolder, 'user');

    expect(Store.getLastValue('cache')).toEqual({ 'user-file.txt': 'fresh content' });
  });
});
