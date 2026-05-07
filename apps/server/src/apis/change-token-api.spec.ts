import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  getUserAccessToken: vi.fn(() => ({
    tokenHash: 'hashed-new-access',
    createdAt: 'now',
    userAgent: 'agent',
    expiresAt: null,
  })),
  getUserRefreshToken: vi.fn(() => ({
    tokenHash: 'hashed-new-refresh',
    createdAt: 'now',
    userAgent: 'agent',
    expiresAt: null,
  })),
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

    const { register } = await import('./change-token-api');
    register(app);

    await handlerPromise();
    expect(getDatabase().prepare('SELECT user_token_hash FROM users WHERE username_hash = ?').get('user')).toEqual({
      user_token_hash: 'hashed-new-user-token',
    });
    expect(response.setCookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-access', expect.any(Object));
    expect(response.setCookie).toHaveBeenCalledWith(COOKIE_REFRESH_TOKEN, 'new-refresh', expect.any(Object));
    expect(response.send).toHaveBeenCalledWith({ newToken: 'new-user-token' });
  });

  it('creates missing DB user while rotating token', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-token-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ newToken: 'new-user-token' });
  });
});
