import { buildApp } from '@server-mocks/build-app-mock';
import { mockResponse } from '@server-mocks/response-mock';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { rmSync } from 'fs';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

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
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock)
      .mockReturnValueOnce('/data') // dataFolder
      .mockReturnValueOnce({}) // cache
      .mockReturnValueOnce({
        'user-hash': { accessTokens: [] },
      }) // users
      .mockReturnValueOnce({
        'user-hash': { theme: 'dark' },
      }); // userSettings
    (Store.set as Mock).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./delete-user-api');
    register(app);

    await handlerPromise();

    expect(setSpy.mock.calls.some(([key]) => key === 'users')).toBe(true);
    expect(setSpy.mock.calls.some(([key]) => key === 'userSettings')).toBe(true);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(FOLDERS.store), { recursive: true, force: true });
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./delete-user-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
