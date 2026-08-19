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
  getUserAccessToken: vi.fn((_token: string, userAgent: string) => ({
    tokenHash: 'hashed-new-access',
    createdAt: 'now',
    userAgent,
    expiresAt: null,
  })),
  getUserRefreshToken: vi.fn((_token: string, userAgent: string) => ({
    tokenHash: 'hashed-new-refresh',
    createdAt: 'now',
    userAgent,
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

  it('stores empty User-Agent metadata when the header is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-token-api');
    register(app);

    await handlerPromise();
    expect(getDatabase().prepare('SELECT user_agent FROM access_tokens WHERE username_hash = ?').get('user')).toEqual({
      user_agent: '',
    });
    expect(getDatabase().prepare('SELECT user_agent FROM refresh_tokens WHERE username_hash = ?').get('user')).toEqual({
      user_agent: '',
    });
  });

  it('rolls back the complete rotation when a token insert fails', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'old-user-token');
    db.prepare('INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent) VALUES (?, ?, ?, ?)').run(
      'user',
      'old-access',
      'now',
      'agent'
    );
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent) VALUES (?, ?, ?, ?)'
    ).run('user', 'old-refresh', 'now', 'agent');
    db.exec(`
      CREATE TEMP TRIGGER fail_refresh_token_insert
      BEFORE INSERT ON refresh_tokens
      BEGIN
        SELECT RAISE(ABORT, 'refresh insert failed');
      END;
    `);
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);

    try {
      const { register } = await import('./change-token-api');
      register(app);
      await handlerPromise();
    } finally {
      db.exec('DROP TRIGGER fail_refresh_token_insert');
    }

    expect(response.code).toHaveBeenCalledWith(500);
    expect(db.prepare('SELECT user_token_hash FROM users WHERE username_hash = ?').get('user')).toEqual({
      user_token_hash: 'old-user-token',
    });
    expect(db.prepare('SELECT token_hash FROM access_tokens WHERE username_hash = ?').all('user')).toEqual([
      { token_hash: 'old-access' },
    ]);
    expect(db.prepare('SELECT token_hash FROM refresh_tokens WHERE username_hash = ?').all('user')).toEqual([
      { token_hash: 'old-refresh' },
    ]);
    expect(response.setCookie).not.toHaveBeenCalled();
  });
});
