import { Store } from '@server/core/store/store';
import { removeItem } from '@server/core/utils/cache-util';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { existsSync } from 'fs';

jest.mock('@server/core/store/store');
jest.mock('@server/core/utils/cache-util');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

describe('delete-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('deletes existing item', async () => {
    const request: any = { params: { name: 'file.md' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(true);

    jest.isolateModules(() => {
      require('./delete-api');
    });

    await handlerPromise();
    expect(removeItem).toHaveBeenCalledWith('file.md', 'user');
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 404 when file not found', async () => {
    const request: any = { params: { name: 'missing' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(false);

    jest.isolateModules(() => {
      require('./delete-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const request: any = { params: { name: 'file.md' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./delete-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
