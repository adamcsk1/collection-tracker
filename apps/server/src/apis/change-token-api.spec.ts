import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { Store } from '../core/store/store';
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  generateRandomToken: vi.fn().mockReturnValue('new-user-token'),
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('new-access'),
  generateRefreshToken: vi.fn().mockReturnValue('new-refresh'),
  jwtGuard: vi.fn((_request: any, _response: any, next: any) => next()),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn(() => ({ tokenHash: 'hashed-new-access' })),
  getUserRefreshToken: vi.fn(() => ({ tokenHash: 'hashed-new-refresh' })),
}));

describe('change-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rotates user token and sets new cookies', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { accessTokens: [], refreshTokens: [] } });
    (Store.set as Mock).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./change-token-api');
    register(app);

    await handlerPromise();
    expect(setSpy).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        user: expect.objectContaining({ userTokenHash: 'hashed-new-user-token' }),
      })
    );
    expect(response.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-access', expect.any(Object));
    expect(response.cookie).toHaveBeenCalledWith(COOKIE_REFRESH_TOKEN, 'new-refresh', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith({ newToken: 'new-user-token' });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./change-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
