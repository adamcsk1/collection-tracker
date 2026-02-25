import { COOKIE_TOKEN } from '@server/core/cookie/cookie-const';
import { Store } from '@server/core/store/store';
import { buildApp } from 'apps/server/test/mocks/build-app-mock';
import { mockResponse } from 'apps/server/test/mocks/repsonse-mock';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('access'),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn((_token: string, _agent: string, expires: Date | null) => ({
    tokenHash: 'hashed-access',
    createdAt: dayjs().toISOString(),
    userAgent: 'agent',
    expiresAt: expires?.toISOString() || null,
  })),
}));

describe('sign-in-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('rejects when user does not exist', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as any).mockReturnValue({});
    (Store.set as any).mockImplementation(() => undefined);

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(404);
  });

  it('rejects when token hash does not match', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as any).mockReturnValue({
      'hashed-neo': { userTokenHash: 'hashed-other', accessTokens: [] },
    });
    (Store.set as any).mockImplementation(() => undefined);

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(401);
  });

  it('sets cookie and prunes expired tokens on success', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as any).mockReturnValue({
      'hashed-neo': {
        userTokenHash: 'hashed-token',
        accessTokens: [{ tokenHash: 'old', expiresAt: dayjs().subtract(1, 'day').toISOString() }],
      },
    });
    (Store.set as any).mockImplementation(() => undefined);
    const setSpy = vi.spyOn(Store, 'set');

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'access', expect.any(Object));
    expect(setSpy).toHaveBeenCalled();
    const updatedUsers = (setSpy.mock.calls[0][1] as any)['hashed-neo'].accessTokens;
    expect(updatedUsers.some((t: any) => t.tokenHash === 'old')).toBe(false);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as any).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
