import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { StoreModel } from '@server/core/store/store-model';
import { removeItem, updateItem } from '@server/core/utils/cache-util';
import { BehaviorSubject } from 'rxjs';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

describe('cache-util', () => {
  const originalStorage = (global as any).__serverStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `cache-util-${Date.now()}`);
    mkdirSync(path.join(tempDir, FOLDERS.store, 'notes'), { recursive: true });

    const store: StoreModel = {
      app: new BehaviorSubject(null),
      dataFolder: new BehaviorSubject<string | null>(tempDir),
      users: new BehaviorSubject(null),
      cache: new BehaviorSubject<{ [key: string]: string }>({}),
    };

    (global as any).__serverStorage = store;
  });

  afterEach(() => {
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    (global as any).__serverStorage = originalStorage;
  });

  it('updates file contents and cache when updating an item', () => {
    const storeSetSpy = jest.spyOn(Store, 'set');

    updateItem('file.txt', 'notes', 'hello');

    const filePath = path.join(tempDir, FOLDERS.store, 'notes', 'file.txt');
    expect(readFileSync(filePath, { encoding: 'utf-8' })).toBe('hello');
    expect(Store.getLastValue('cache')).toEqual({ 'notes-file.txt': 'hello' });
    expect(storeSetSpy).toHaveBeenCalledWith('cache', { 'notes-file.txt': 'hello' });
  });

  it('removes file and cache entry when removing an item', () => {
    const filePath = path.join(tempDir, FOLDERS.store, 'notes', 'file.txt');
    writeFileSync(filePath, 'to delete');
    Store.set('cache', { 'notes-file.txt': 'cached' });
    const storeSetSpy = jest.spyOn(Store, 'set');

    removeItem('file.txt', 'notes');

    expect(existsSync(filePath)).toBe(false);
    expect(Store.getLastValue('cache')).toEqual({});
    expect(storeSetSpy).toHaveBeenCalledWith('cache', {});
  });
});
