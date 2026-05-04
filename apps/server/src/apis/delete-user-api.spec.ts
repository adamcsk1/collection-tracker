import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('delete-user-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('removes user and clears data folder', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app, handlerPromise } = buildApp(request, response);
    getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user-hash', 'token');

    const { register } = await import('./delete-user-api');
    register(app);

    await handlerPromise();

    expect(
      getDatabase().prepare('SELECT COUNT(*) as count FROM users WHERE username_hash = ?').get('user-hash')
    ).toEqual({ count: 0 });
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });

  it('returns 204 when user is already absent', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user-hash' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./delete-user-api');
    register(app);

    await handlerPromise();
    expect(response.sendStatus).toHaveBeenCalledWith(204);
  });
});
