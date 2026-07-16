import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { getDatabase } from '../core/database/database';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('access'),
  generateRefreshToken: vi.fn().mockReturnValue('refresh'),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn((_token: string, _agent: string, expires: Date | null) => ({
    tokenHash: 'hashed-access',
    createdAt: dayjs().toISOString(),
    userAgent: 'agent',
    expiresAt: expires?.toISOString() || null,
  })),
  getUserRefreshToken: vi.fn((_token: string, _agent: string, expires: Date | null) => ({
    tokenHash: 'hashed-refresh',
    createdAt: dayjs().toISOString(),
    userAgent: 'agent',
    expiresAt: expires?.toISOString() || null,
  })),
}));

describe('sign-in-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AUTH_RATE_LIMIT;
  });

  it('returns 400 when body is invalid', async () => {
    const response = mockResponse();
    const request: any = { body: { username: '', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.AUTH_RATE_LIMIT = '123';

    const { register } = await import('./sign-in-api');
    register(app);

    expect(app.post).toHaveBeenCalledWith(
      expect.any(String),
      { config: { rateLimit: { max: 123, timeWindow: '1 minute' } } },
      expect.any(Function)
    );
    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects when user does not exist', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });

  it('rejects when token hash does not match', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    getDatabase()
      .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
      .run('hashed-neo', 'hashed-other');

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(401);
  });

  it('sets both cookies and prunes expired tokens on success', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-neo', 'hashed-token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-neo', 'old', 'now', 'agent', dayjs().subtract(1, 'day').toISOString());
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-neo', 'old-refresh', 'now', 'agent', dayjs().subtract(1, 'day').toISOString());

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.setCookie).toHaveBeenCalledWith(COOKIE_TOKEN, 'access', expect.any(Object));
    expect(response.setCookie).toHaveBeenCalledWith(COOKIE_REFRESH_TOKEN, 'refresh', expect.any(Object));
    expect(db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE token_hash = ?').get('old')).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE token_hash = ?').get('old-refresh')).toEqual({
      count: 0,
    });
  });

  it('returns 404 when no DB user exists', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
