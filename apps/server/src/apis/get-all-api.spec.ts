import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { readdirSync, readFileSync } from 'fs';

jest.mock('@server/core/store/store');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('get-all-api', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns cached contents without rereading files', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock)
      .mockReturnValueOnce('/data') // dataFolder
      .mockReturnValueOnce({ 'user-file1': 'cached' }); // cache
    (readdirSync as jest.Mock).mockReturnValue(['file1']);

    jest.isolateModules(() => {
      require('./get-all-api');
    });

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'cached' }]);
  });

  it('reads uncached files and updates cache', async () => {
    const response = mockResponse();
    const request: any = { query: { limit: '2', offset: '0' }, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValueOnce('/data').mockReturnValueOnce({}); // cache
    (Store.set as jest.Mock).mockImplementation((_key: string, value: any) => value);
    (readdirSync as jest.Mock).mockReturnValue(['file1']);
    (readFileSync as jest.Mock).mockReturnValue('content');

    jest.isolateModules(() => {
      require('./get-all-api');
    });

    await handlerPromise();

    expect(Store.set).toHaveBeenCalledWith('cache', { 'user-file1': 'content' });
    expect(response.send).toHaveBeenCalledWith([{ name: 'file1', content: 'content' }]);
  });

  it('sends 500 on error', async () => {
    const response = mockResponse();
    const request: any = { query: {}, usernameHash: 'user' };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./get-all-api');
    });

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
