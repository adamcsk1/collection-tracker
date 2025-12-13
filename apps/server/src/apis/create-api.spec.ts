import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
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

describe('create-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates a new file and returns name', async () => {
    const response = mockResponse();
    const request: any = {
      body: { content: 'body' },
      usernameHash: 'user',
    };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);

    await import('./create-api');

    await handlerPromise();
    expect(updateItem).toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(String) }));
  });

  it('returns conflict when file already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);

    await import('./create-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    await import('./create-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
