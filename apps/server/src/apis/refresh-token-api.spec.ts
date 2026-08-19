import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { getDatabase } from '../core/database/database';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('new-access'),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn((_token: string, userAgent: string, expires: Date | null) => ({
    tokenHash: 'hashed-new-access',
    createdAt: dayjs().toISOString(),
    userAgent,
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
    delete process.env.AUTH_RATE_LIMIT;
    delete process.env.REFRESH_RATE_LIMIT;
  });

  it('returns 401 when no refresh token is provided', async () => {
    const response = mockResponse();
    const request: any = { cookies: {}, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.REFRESH_RATE_LIMIT = '123';

    const { register } = await import('./refresh-token-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(
      expect.any(String),
      { config: { rateLimit: { max: 123, timeWindow: '1 minute' } } },
      expect.any(Function)
    );
    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(401);
  });

  it('returns 403 for an invalid refresh token', async () => {
    const response = mockResponse();
    const request: any = { cookies: { [COOKIE_REFRESH_TOKEN]: 'invalid-token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when refresh token is not recognized', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { cookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-user', 'token');
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-user', 'other', 'now', 'agent', null);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('issues a new access token without requiring User-Agent metadata', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { cookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-user', 'token');
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-user', `hashed-${token}`, dayjs().toISOString(), 'agent', null);

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.setCookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'new-access', expect.any(Object));
    expect(response.code).toHaveBeenCalledWith(204);
    expect(db.prepare('SELECT user_agent FROM access_tokens WHERE token_hash = ?').get('hashed-new-access')).toEqual({
      user_agent: '',
    });
  });

  it('prunes expired refresh tokens before validating', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { cookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-user', 'token');
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-user', `hashed-${token}`, dayjs().toISOString(), 'agent', dayjs().subtract(1, 'day').toISOString());

    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when the user has no stored refresh token', async () => {
    const response = mockResponse();
    const token = jwt.sign({ username: 'user' }, 'secret');
    const request: any = { cookies: { [COOKIE_REFRESH_TOKEN]: token }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./refresh-token-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });
});
