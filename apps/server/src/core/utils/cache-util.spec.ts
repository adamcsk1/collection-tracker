import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { StoreModel } from '@server/core/store/store-model';
import { CACHE_MAX, removeItem, updateItem } from '@server/core/utils/cache-util';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      cache: new BehaviorSubject<{ [key: string]: string }>({}),
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
