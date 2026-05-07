import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { COOKIE_REFRESH_TOKEN, COOKIE_TOKEN } from '../core/cookie/cookie-const';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  hashText: vi.fn(() => 'hashed-token'),
}));

describe('logout-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears both cookies and returns 204', async () => {
    const response = mockResponse();
    const request: any = {
      cookies: { [COOKIE_TOKEN]: 'token', [COOKIE_REFRESH_TOKEN]: 'refresh' },
      headers: {},
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'hashed-token', 'now', 'agent', null);
    db.prepare(
      'INSERT INTO refresh_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'hashed-token', 'now', 'agent', null);

    const { register } = await import('./logout-api');
    register(app);

    await handlerPromise();

    expect(response.clearCookie).toHaveBeenCalledWith(COOKIE_TOKEN);
    expect(response.clearCookie).toHaveBeenCalledWith(COOKIE_REFRESH_TOKEN);
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it('returns 204 when token rows are already absent', async () => {
    const response = mockResponse();
    const request: any = { cookies: { [COOKIE_TOKEN]: 'token' }, headers: {}, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./logout-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(204);
  });
});
