import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');
jest.mock('@server/core/jwt', () => ({
  generateAccessToken: jest.fn().mockReturnValue('access'),
  jwtGuard: jest.fn((_req: any, _res: any, next: any) => next()),
}));
jest.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: jest.fn(async () => ({ tokenHash: 'hashed-access' })),
}));

describe('create-access-token-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('creates a new access token and stores it', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({ user: { accessTokens: [] } });
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    const setSpy = jest.spyOn(Store, 'set');

    jest.isolateModules(() => {
      require('./create-access-token-api');
    });

    await handlerPromise();

    expect(setSpy).toHaveBeenCalledWith('users', { user: { accessTokens: [{ tokenHash: 'hashed-access' }] } });
    expect(response.send).toHaveBeenCalledWith({ accessToken: 'access' });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./create-access-token-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
