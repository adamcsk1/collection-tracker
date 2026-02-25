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

describe('modify-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('updates an existing item', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(true);
    (Store.set as Mock).mockImplementation(() => undefined);
    (updateItem as Mock).mockImplementation(() => undefined);
    (response.sendStatus as Mock).mockReturnValue(response);

    const { register } = await import('./modify-api');
    register(app);

    await handlerPromise();

    expect(updateItem).toHaveBeenCalledWith('file.md', 'user', 'updated');
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 404 when file is missing', async () => {
    const request: any = { params: { name: 'missing.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue('/data');
    (existsSync as Mock).mockReturnValue(false);

    const { register } = await import('./modify-api');
    register(app);

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./modify-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
