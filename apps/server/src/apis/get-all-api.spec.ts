import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { readdirSync, readFileSync } from 'fs';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('fs', async () => {
  const fs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...fs,
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('get-all-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns cached contents without rereading files', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock)
      .mockReturnValueOnce('/data') // dataFolder
      .mockReturnValueOnce({ 'user-file1': 'cached' }); // cache
    (readdirSync as Mock).mockReturnValue(['file1']);

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'cached' }]);
  });

  it('reads uncached files and updates cache', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValueOnce('/data').mockReturnValueOnce({}); // cache
    (Store.set as Mock).mockImplementation((_key: string, value: any) => value);
    (readdirSync as Mock).mockReturnValue(['file1']);
    (readFileSync as Mock).mockReturnValue('content');

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(Store.set).toHaveBeenCalledWith('cache', { 'user-file1': 'content' });
    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'content' }]);
  });

  it('sends 500 on error', async () => {
    const response = mockResponse();
    const request: any = { query: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
