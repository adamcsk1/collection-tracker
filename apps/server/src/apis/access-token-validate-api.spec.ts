import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/response-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('new-token'),
  jwtGuard: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn(() => ({ tokenHash: 'hashed-new-token' })),
}));

describe('access-token-validate-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

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
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue(storeValue);
    (Store.set as Mock).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./access-token-validate-api');
    register(app);

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
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./access-token-validate-api');
    register(app);

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
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./access-token-validate-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
