import { Store } from '@server/core/store/store';
import { removeItem } from '@server/core/utils/cache-util';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { existsSync } from 'fs';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/utils/cache-util');
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

  it('deletes existing item', async () => {
    const request: any = { params: { name: 'file.md' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);

    await import('./delete-api');

    await handlerPromise();
    expect(removeItem).toHaveBeenCalledWith('file.md', 'user');
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 404 when file not found', async () => {
    const request: any = { params: { name: 'missing' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);

    await import('./delete-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const request: any = { params: { name: 'file.md' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    await import('./delete-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
