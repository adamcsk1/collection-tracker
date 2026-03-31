import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/response-mock';
import { readdir, readFile, stat } from 'fs/promises';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return { ...actual, readdir: vi.fn(), readFile: vi.fn(), stat: vi.fn() };
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
      .mockReturnValueOnce({ 'user-file1': 'cached' }) // cache
      .mockReturnValueOnce({ 'user-file1': 'hash1' }); // fileHashes
    (readdir as Mock).mockResolvedValue(['file1']);
    (stat as Mock).mockResolvedValue({ birthtimeMs: 1000 });

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'cached', hash: 'hash1' }]);
  });

  it('reads uncached files and updates cache', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock)
      .mockReturnValueOnce('/data')
      .mockReturnValueOnce({}) // cache
      .mockReturnValueOnce({}); // fileHashes
    (Store.set as Mock).mockImplementation((_key: string, value: any) => value);
    (readdir as Mock).mockResolvedValue(['file1']);
    (readFile as Mock).mockResolvedValue('content');
    (stat as Mock).mockResolvedValue({ birthtimeMs: 1000 });

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(Store.set).toHaveBeenCalledWith('cache', { 'user-file1': 'content' });
    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'content', hash: '' }]);
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

  it('orders files by creation date descending before pagination', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock)
      .mockReturnValueOnce('/data')
      .mockReturnValueOnce({}) // cache
      .mockReturnValueOnce({}); // fileHashes
    (Store.set as Mock).mockImplementation((_key: string, value: any) => value);
    (readdir as Mock).mockResolvedValue(['old.md', 'new.md', 'middle.md']);
    (readFile as Mock).mockImplementation((filePath: string) => Promise.resolve(filePath));
    (stat as Mock).mockImplementation((filePath: string) =>
      Promise.resolve({
        birthtimeMs: filePath === '/data/store/user/new.md'
          ? 3000
          : filePath === '/data/store/user/middle.md'
          ? 2000
          : 1000,
      })
    );

    const { register } = await import('./get-all-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([
      { name: 'new.md', content: '/data/store/user/new.md', hash: '' },
      { name: 'middle.md', content: '/data/store/user/middle.md', hash: '' },
    ]);
  });
});
