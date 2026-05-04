import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('delete-access-token-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes matching access token', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run('user', 'remove', 'now', 'agent', null);

    const { register } = await import('./delete-access-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
    expect(db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE token_hash = ?').get('remove')).toEqual({
      count: 0,
    });
  });

  it('returns 204 when token is absent', async () => {
    const response = mockResponse();
    const request: any = { params: { tokenHash: 'remove' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-access-token-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });
});
