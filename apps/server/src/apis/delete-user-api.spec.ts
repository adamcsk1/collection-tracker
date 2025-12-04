import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { rmSync } from 'fs';

jest.mock('@server/core/store/store');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  rmSync: jest.fn(),
}));

describe('delete-user-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('removes user and clears data folder', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock)
      .mockReturnValueOnce('/data') // dataFolder
      .mockReturnValueOnce({}) // cache
      .mockReturnValueOnce({
        'user-hash': { accessTokens: [] },
      }); // users
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    const setSpy = jest.spyOn(Store, 'set');

    jest.isolateModules(() => {
      require('./delete-user-api');
    });

    await handlerPromise();

    expect(setSpy.mock.calls.some(([key]) => key === 'users')).toBe(true);
    expect(rmSync).toHaveBeenCalledWith(expect.stringContaining(FOLDERS.store), { recursive: true, force: true });
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./delete-user-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
