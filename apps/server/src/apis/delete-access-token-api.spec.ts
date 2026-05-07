import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { hashText } from '../core/crypto';
import { generateAccessToken } from '../core/jwt';
import { SERVER_MAX_PARAM_LENGTH } from '../core/main-const';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';

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
    expect(response.code).toHaveBeenCalledWith(204);
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
    expect(response.code).toHaveBeenCalledWith(204);
  });

  it('matches SHA-512 token hash route params', async () => {
    process.env.JWT_SECRET = 'secret';
    process.env.COOKIE_SECRET = 'cookie-secret';
    const app = fastify({ routerOptions: { maxParamLength: SERVER_MAX_PARAM_LENGTH } });
    const db = getDatabase();
    const username = 'user';
    const usernameHash = hashText(username);
    const accessToken = await generateAccessToken(username);
    const tokenHash = hashText(accessToken);
    const tokenToDelete = hashText('token-to-delete');

    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(usernameHash, tokenHash, 'now', 'agent', null);
    db.prepare(
      'INSERT INTO access_tokens (username_hash, token_hash, created_at, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(usernameHash, tokenToDelete, 'now', 'agent', null);

    const { register } = await import('./delete-access-token-api');
    await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
    register(app);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/user/access-token/${tokenToDelete}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(204);
    expect(db.prepare('SELECT COUNT(*) as count FROM access_tokens WHERE token_hash = ?').get(tokenToDelete)).toEqual({
      count: 0,
    });
  });
});
