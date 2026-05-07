import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@server/core/crypto', () => ({
  generateRandomToken: vi.fn().mockReturnValue('generated-token'),
  hashText: vi.fn((text: string) => `hashed-${text}`),
}));
describe('sign-up-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DISABLE_REGISTRATION;
    delete process.env.USER_LIMIT;
  });

  it('returns 400 when username is missing', async () => {
    const response = mockResponse();
    const request: any = { body: {} };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '0';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 403 when registration disabled', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '1';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('creates user and returns token', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ token: 'generated-token' });
    expect(
      getDatabase().prepare('SELECT user_token_hash FROM users WHERE username_hash = ?').get('hashed-neo')
    ).toEqual({
      user_token_hash: 'hashed-generated-token',
    });
  });

  it('returns 409 when user already exists', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    getDatabase()
      .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
      .run('hashed-neo', 'token');
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });

  it('returns 403 when user limit reached', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '0';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 409 when DB insert conflicts', async () => {
    const response = mockResponse();
    const request: any = { body: { username: 'neo' } };
    const { app, handlerPromise } = buildApp(request, response);
    getDatabase()
      .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
      .run('hashed-neo', 'token');
    process.env.DISABLE_REGISTRATION = '0';
    process.env.USER_LIMIT = '5';

    const { register } = await import('./sign-up-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(409);
  });
});
