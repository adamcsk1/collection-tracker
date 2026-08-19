import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/jwt', () => ({
  generateAccessToken: vi.fn().mockReturnValue('access'),
  jwtGuard: vi.fn((_request: any, _response: any, next: any) => next()),
}));
vi.mock('@server/core/utils/users-util', () => ({
  getUserAccessToken: vi.fn((_token: string, userAgent: string) => ({
    tokenHash: 'hashed-access',
    createdAt: 'now',
    userAgent,
    expiresAt: null,
  })),
}));

describe('create-access-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('creates a new access token without requiring User-Agent metadata', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: {} };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./create-access-token-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ accessToken: 'access' });
    expect(db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE username_hash = ?').get('user')).toEqual({
      count: 1,
    });
    expect(db.prepare('SELECT user_agent FROM access_tokens WHERE username_hash = ?').get('user')).toEqual({
      user_agent: '',
    });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', username: 'user', headers: { 'user-agent': 'agent' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./create-access-token-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
