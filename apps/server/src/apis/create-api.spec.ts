import { buildApp } from '@server-mocks/build-app-mock';
import { mockResponse } from '@server-mocks/response-mock';
import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
import { hashFileExists } from '@server/core/utils/hash-util';
import { existsSync } from 'fs';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/utils/cache-util');
vi.mock('@server/core/utils/hash-util');
vi.mock('fs', async () => {
  const fs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...fs,
    existsSync: vi.fn(),
  };
});

describe('create-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('creates a new file and returns name', async () => {
    const response = mockResponse();
    const request: any = {
      body: { content: 'body', name: 'custom-file.md' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);
    (hashFileExists as Mock).mockReturnValue(false);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(updateItem).toHaveBeenCalledWith('custom-file.md', 'user', 'body');
    expect(response.send).toHaveBeenCalledWith({ name: 'custom-file.md' });
  });

  it('adds an index suffix when file already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body', name: 'custom-file.md' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValueOnce(true).mockReturnValueOnce(false);
    (hashFileExists as Mock).mockReturnValue(false);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(updateItem).toHaveBeenCalledWith('custom-file-1.md', 'user', 'body');
    expect(response.send).toHaveBeenCalledWith({ name: 'custom-file-1.md' });
  });

  it('returns 409 when a hash file already exists for the resolved filename', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body', name: 'custom-file.md' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);
    (hashFileExists as Mock).mockReturnValue(true);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 400 when name is invalid', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body', name: 'custom-file.txt' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body', name: 'custom-file.md' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./create-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
