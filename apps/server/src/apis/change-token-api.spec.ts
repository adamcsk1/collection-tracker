import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  generateRandomToken: vi.fn().mockReturnValue('new-user-token'),
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('new-access'),
  jwtGuard: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn(() => ({ tokenHash: 'hashed-new-access' })),
}));

describe('change-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rotates user token and sets new cookie', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({ user: { accessTokens: [] } });
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
