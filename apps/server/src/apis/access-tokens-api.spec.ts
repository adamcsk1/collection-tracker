import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('access-tokens-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns access tokens for user', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'abc', 'now', 'agent', null);

    const { register } = await import('./access-tokens-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([
      { tokenHash: 'abc', createdAt: 'now', userAgent: 'agent', expiresAt: null },
    ]);
  });

  it('returns an empty array when no tokens exist', async () => {
    const request: any = { usernameHash: 'user' };
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./access-tokens-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith([]);
  });
});
