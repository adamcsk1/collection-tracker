import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';

jest.mock('@server/core/store/store');
jest.mock('@server/core/crypto', () => ({
  hashText: jest.fn(async (text: string) => `hashed-${text}`),
}));
jest.mock('@server/core/jwt', () => ({
  generateAccessToken: jest.fn().mockReturnValue('new-token'),
  jwtGuard: jest.fn((_req: any, _res: any, next: any) => next()),
}));
jest.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: jest.fn(async () => ({ tokenHash: 'hashed-new-token' })),
}));

describe('access-token-validate-api', () => {
  afterEach(() => jest.clearAllMocks());

  it('rotates cookie token and updates users cache when coming from cookie', async () => {
    const storeValue = {
      userHash: { accessTokens: [{ tokenHash: 'hashed-old' }] },
    };
    const response = mockResponse();
    const request: any = {
      signedCookies: { [COOKIE_TOKEN]: 'old-token' },
      headers: { 'user-agent': 'agent' },
      username: 'user',
      usernameHash: 'userHash',
    };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockReturnValue(storeValue);
    (Store.set as jest.Mock).mockImplementation(() => undefined);
    const setSpy = jest.spyOn(Store, 'set');

    jest.isolateModules(() => {
      require('./access-token-validate-api');
    });

    await handlerPromise();

    expect(response.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-token', expect.any(Object));
    expect(setSpy).toHaveBeenCalled();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 204 immediately when token supplied via authorization header', async () => {
    const response = mockResponse();
    const request: any = {
      signedCookies: {},
      headers: { authorization: 'Bearer token' },
      username: 'user',
      usernameHash: 'userHash',
    };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);

    jest.isolateModules(() => {
      require('./access-token-validate-api');
    });

    await handlerPromise();

    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = {
      signedCookies: {},
      headers: {},
      username: 'user',
      usernameHash: 'userHash',
    };
    const { app$, handlerPromise } = buildApp(request, response);
    (Store.getOnce$ as jest.Mock).mockReturnValue(app$);
    (Store.getLastValue as jest.Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    jest.isolateModules(() => {
      require('./access-token-validate-api');
    });

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
