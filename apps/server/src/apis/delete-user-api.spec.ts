import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { rmSync } from 'fs';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('fs', async () => {
  const fs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...fs,
    existsSync: vi.fn().mockReturnValue(true),
    rmSync: vi.fn(),
  };
});

describe('delete-user-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('removes user and clears data folder', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock)
      .mockReturnValueOnce('/data') // dataFolder
      .mockReturnValueOnce({}) // cache
      .mockReturnValueOnce({
        'user-hash': { accessTokens: [] },
      }); // users
    (Store.set as Mock).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    await import('./delete-user-api');

    await handlerPromise();

    expect(setSpy.mock.calls.some(([key]) => key === 'users')).toBe(true);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(FOLDERS.store), { recursive: true, force: true });
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as Mock).mockReturnValue(app$);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    await import('./delete-user-api');

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
