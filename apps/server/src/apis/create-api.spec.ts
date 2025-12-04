import { Store } from '@server/core/store/store';
import { updateItem } from '@server/core/utils/cache-util';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { existsSync } from 'fs';

jest.mock('@server/core/store/store');
jest.mock('@server/core/utils/cache-util');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

describe('create-api', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new file and returns name', async () => {
    const response = mockResponse();
    const request: any = {
      body: { content: 'body' },
      usernameHash: 'user',
    };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(false);

    jest.isolateModules(() => {
      require('./create-api');
    });

    await handlerPromise();
    expect(updateItem).toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(String) }));
  });

  it('returns conflict when file already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(true);

    jest.isolateModules(() => {
      require('./create-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { content: 'body' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./create-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
