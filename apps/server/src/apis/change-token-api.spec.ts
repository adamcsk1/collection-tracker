import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');
jest.mock('@server/core/crypto', () => ({
  generateRandomToken: jest.fn().mockReturnValue('new-user-token'),
  hashText: jest.fn(async (text: string) => `hashed-${text}`),
}));
jest.mock('@server/core/jwt', () => ({
  generateAccessToken: jest.fn().mockReturnValue('new-access'),
  jwtGuard: jest.fn((_req: any, _res: any, next: any) => next()),
}));
jest.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: jest.fn(async () => ({ tokenHash: 'hashed-new-access' })),
}));

describe('change-token-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('rotates user token and sets new cookie', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue({ user: { accessTokens: [] } });
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    const setSpy = jest.spyOn(Store, 'set');

    jest.isolateModules(() => {
      require('./change-token-api');
    });

    await handlerPromise();
    expect(setSpy).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        user: expect.objectContaining({ userTokenHash: 'hashed-new-user-token' }),
      })
    );
    expect(response.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-access', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith({ newToken: 'new-user-token' });
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
      require('./change-token-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
