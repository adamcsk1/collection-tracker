import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { Store } from '../core/store/store';
import { removeItem } from '../core/utils/cache-util';
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

describe('delete-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when hash query param is missing', async () => {
    const request: any = { params: { name: 'file.md' }, query: {}, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(400);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('deletes existing item when hash matches', async () => {
    const request: any = { params: { name: 'file.md' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue('abc123');

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(removeItem).toHaveBeenCalledWith('file.md', 'user');
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 409 when hash does not match', async () => {
    const request: any = { params: { name: 'file.md' }, query: { hash: 'wrong-hash' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue('correct-hash');

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns 409 when no stored hash exists', async () => {
    const request: any = { params: { name: 'file.md' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (getMemoryHash as Mock).mockReturnValue(undefined);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns 404 when file not found', async () => {
    const request: any = { params: { name: 'missing' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const request: any = { params: { name: 'file.md' }, query: { hash: 'abc123' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./delete-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
