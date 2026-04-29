import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { Store } from '../core/store/store';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('@server/core/store/store');
vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('new-access'),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn((_token: string, _agent: string, expires: Date | null) => ({
    tokenHash: 'hashed-new-access',
    createdAt: dayjs().toISOString(),
    userAgent: 'agent',
    expiresAt: expires?.toISOString() || null,
  })),
}));

describe('refresh-token-api', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'secret';
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 401 when no refresh token is provided', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: {}, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(401);
  });

  it('returns 403 for an invalid refresh token', async () => {
    const response = mockResponse();
    const request: any = { signedCookies: { [COOKIE_REFRESH_TOKEN]: 'invalid-token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('returns 403 when refresh token is not recognized', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { signedCookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({
      'hashed-user': { refreshTokens: [{ tokenHash: 'other' }] },
    });

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('issues a new access token and sets cookie for a valid refresh token', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { signedCookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({
      'hashed-user': {
        accessTokens: [],
        refreshTokens: [
          { tokenHash: `hashed-${token}`, createdAt: dayjs().toISOString(), userAgent: 'agent', expiresAt: null },
        ],
      },
    });
    (Store.set as Mock).mockImplementation(() => undefined);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.cookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-access', expect.any(Object));
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('prunes expired refresh tokens before validating', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { signedCookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockReturnValue({
      'hashed-user': {
        accessTokens: [],
        refreshTokens: [
          {
            tokenHash: `hashed-${token}`,
            createdAt: dayjs().toISOString(),
            userAgent: 'agent',
            expiresAt: dayjs().subtract(1, 'day').toISOString(),
          },
        ],
      },
    });

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(403);
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { signedCookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    (Store.getLastValue as Mock).mockImplementation(() => {
      throw new Error('fail');
    });

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(500);
  });
});
