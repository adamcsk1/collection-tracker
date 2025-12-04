import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { mkdirSync } from 'fs';

jest.mock('@server/core/store/store');
jest.mock('@server/core/crypto', () => ({
  generateRandomToken: jest.fn().mockReturnValue('generated-token'),
  hashText: jest.fn(async (text: string) => `hashed-${text}`),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('sign-up-api', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DISABLE_REGISTRATION;
    delete process.env.USER_LIMIT;
  });

  it('returns 403 when registration disabled', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    process.env.DISABLE_REGISTRATION = '1';

    jest.isolateModules(() => {
      require('./sign-up-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('creates user and returns token', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValueOnce({}).mockReturnValueOnce('/data');
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    jest.isolateModules(() => {
      require('./sign-up-api');
    });

    await handlerPromise();
    expect(Store.set).toHaveBeenCalledWith('users', expect.any(Object));
    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining(FOLDERS.store), { recursive: true });
    expect(response.send).toHaveBeenCalledWith({ token: 'generated-token' });
  });

  it('returns 409 when user already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({ 'hashed-neo': {} });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    jest.isolateModules(() => {
      require('./sign-up-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(409);
  });

  it('returns 403 when user limit reached', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({ existing: {} });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '0';

    jest.isolateModules(() => {
      require('./sign-up-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    jest.isolateModules(() => {
      require('./sign-up-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
