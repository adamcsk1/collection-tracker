import { Store } from './store';
import { StoreModel } from './store-model';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const createStore = (): StoreModel => ({
  dataFolder: new BehaviorSubject<string | null>('data'),
  users: new BehaviorSubject(null),
  parserConfigs: new BehaviorSubject(null),
  tagConfigs: new BehaviorSubject(null),
  userSettings: new BehaviorSubject(null),
  cache: new BehaviorSubject<{ [key: string]: string }>({ cached: 'x' }),
  fileHashes: new BehaviorSubject<{ [key: string]: string }>({}),
});

describe('Store', () => {
  const originalStorage = (global as any).__serverStorage;

  beforeEach(() => {
    (global as any).__serverStorage = createStore();
  });

  afterEach(() => {
    (global as any).__serverStorage = originalStorage;
  });

  it('gets observable values and last value clones', async () => {
    const value = await firstValueFrom(Store.get$('dataFolder'));
    expect(value).toBe('data');
    expect(Store.getLastValue('cache')).toEqual({ cached: 'x' });

    const cache = Store.getLastValue('cache');
    cache.cached = 'y';
    expect(Store.getLastValue('cache')).toEqual({ cached: 'x' });
  });

  it('getOnce$ emits once when value is present', async () => {
    const once = await firstValueFrom(Store.getOnce$('dataFolder'));
    expect(once).toBe('data');
  });

  it('sets and resets values', () => {
    Store.set('dataFolder', 'new');
    expect(Store.getLastValue('dataFolder')).toBe('new');

    Store.reset('dataFolder');
    expect(Store.getLastValue('dataFolder')).toBeNull();
  });

  it('resets all subjects', () => {
    Store.resetAll();

    expect(Store.getLastValue('dataFolder')).toBeNull();
    expect(Store.getLastValue('users')).toBeNull();
    expect(Store.getLastValue('parserConfigs')).toBeNull();
    expect(Store.getLastValue('tagConfigs')).toBeNull();
    expect(Store.getLastValue('userSettings')).toBeNull();
    expect(Store.getLastValue('cache')).toEqual({});
    expect(Store.getLastValue('fileHashes')).toEqual({});
  });
});
