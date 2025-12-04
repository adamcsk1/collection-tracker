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

describe('modify-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('updates an existing item', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(true);
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    (updateItem as jest.Mock).mockImplementation(() => undefined);
    (response.sendStatus as jest.Mock).mockReturnValue(response);

    jest.isolateModules(() => {
      require('./modify-api');
    });

    await handlerPromise();

    expect(updateItem).toHaveBeenCalledWith('file.md', 'user', 'updated');
    expect(response.send).toHaveBeenCalled();
  });

  it('returns 404 when file is missing', async () => {
    const request: any = { params: { name: 'missing.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const response = mockResponse();
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue('/data');
    (existsSync as jest.Mock).mockReturnValue(false);

    jest.isolateModules(() => {
      require('./modify-api');
    });

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { params: { name: 'file.md' }, body: { content: 'updated' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./modify-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
