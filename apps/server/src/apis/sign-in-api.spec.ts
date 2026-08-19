import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { getDatabase } from '../core/database/database';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '@shared/constants/username-const';
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
  getUserAccessToken: vi.fn((_token: string, userAgent: string, expires: Date | null) => ({
    tokenHash: 'hashed-access',
    createdAt: dayjs().toISOString(),
    userAgent,
    expiresAt: expires?.toISOString() || null,
  })),
  getUserRefreshToken: vi.fn((_token: string, userAgent: string, expires: Date | null) => ({
    tokenHash: 'hashed-refresh',
    createdAt: dayjs().toISOString(),
    userAgent,
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

  it('returns 400 when body is missing', async () => {
    const response = mockResponse();
    const request: any = { headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([USERNAME_MIN_LENGTH - 2, USERNAME_MAX_LENGTH + 1])(
    'accepts persisted legacy user with username length %s',
    async (usernameLength) => {
      const response = mockResponse();
      const username = 'u'.repeat(usernameLength);
      const request: any = { body: { username, token: 'token' }, headers: {} };
      const { app, handlerPromise } = buildApp(request, response);
      getDatabase()
        .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
        .run(`hashed-${username}`, 'hashed-token');

      const { register } = await import('./sign-in-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(204);
      expect(response.code).not.toHaveBeenCalledWith(400);
    }
  );

  it.each([USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH])('accepts username boundary length %s', async (usernameLength) => {
    const response = mockResponse();
    const request: any = { body: { username: 'u'.repeat(usernameLength), token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./sign-in-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.code).not.toHaveBeenCalledWith(400);
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
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
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
    expect(response.code).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledWith();
    expect(db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE token_hash = ?').get('old')).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT COUNT(*) as count FROM refresh_tokens WHERE token_hash = ?').get('old-refresh')).toEqual({
      count: 0,
    });
    expect(db.prepare('SELECT user_agent FROM access_tokens WHERE token_hash = ?').get('hashed-access')).toEqual({
      user_agent: '',
    });
    expect(db.prepare('SELECT user_agent FROM refresh_tokens WHERE token_hash = ?').get('hashed-refresh')).toEqual({
      user_agent: '',
    });
  });

  it('rolls back token pruning and insertion when refresh token insertion fails', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo', token: 'token' }, headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('hashed-neo', 'hashed-token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('hashed-neo', 'old', 'now', 'agent', dayjs().subtract(1, 'day').toISOString());
    db.exec(`
      CREATE TEMP TRIGGER fail_refresh_token_insert
      BEFORE INSERT ON refresh_tokens
      BEGIN
        SELECT RAISE(ABORT, 'refresh insert failed');
      END;
    `);

    try {
      const { register } = await import('./sign-in-api');
      register(app);
      await handlerPromise();
    } finally {
      db.exec('DROP TRIGGER fail_refresh_token_insert');
    }

    expect(response.code).toHaveBeenCalledWith(500);
    expect(db.prepare('SELECT token_hash FROM access_tokens WHERE username_hash = ?').all('hashed-neo')).toEqual([
      { token_hash: 'old' },
    ]);
    expect(db.prepare('SELECT token_hash FROM refresh_tokens WHERE username_hash = ?').all('hashed-neo')).toEqual([]);
    expect(response.setCookie).not.toHaveBeenCalled();
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
