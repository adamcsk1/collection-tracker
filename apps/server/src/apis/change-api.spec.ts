import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { Store } from '../core/store/store';
import { updateItem } from '../core/utils/cache-util';
import { getMemoryHash } from '../core/utils/hash-util';
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

describe('change-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when content is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('returns 400 when hash is missing', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
  });

  it('updates an existing item when hash matches', async () => {
    const response = mockResponse();
    const request: any = {
      params: { name: 'file.md' },
      body: { content: 'updated', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue('abc123');
    (Store.set as Mock).mockImplementation(() => undefined);
    (updateItem as Mock).mockImplementation(() => undefined);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();

    expect(updateItem).toHaveBeenCalledWith('file.md', 'user', 'updated');
    expect(response.send).toHaveBeenCalledWith({ hash: 'abc123' });
  });

  it('returns 409 when hash does not match', async () => {
    const response = mockResponse();
    const request: any = {
      params: { name: 'file.md' },
      body: { content: 'updated', hash: 'wrong-hash' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue('correct-hash');

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 409 when no stored hash exists', async () => {
    const response = mockResponse();
    const request: any = {
      params: { name: 'file.md' },
      body: { content: 'updated', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue(undefined);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 404 when file is missing', async () => {
    const request: any = {
      params: { name: 'missing.md' },
      body: { content: 'updated', hash: 'abc123' },
      usernameHash: 'user',
    };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = {
      params: { name: 'file.md' },
      body: { content: 'updated', hash: 'abc123' },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./change-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
