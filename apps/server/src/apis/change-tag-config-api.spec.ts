import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('change-tag-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body is not an array', async () => {
    const response = mockResponse();
    const request: any = { body: { tag: '#a' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body contains invalid item shape', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: 'true',
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when body contains non-object item', async () => {
    const response = mockResponse();
    const request: any = {
      body: [null],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('updates user tag configs and returns updated config', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(request.body);
    expect(db.prepare('SELECT COUNT(*) as count FROM tag_configs WHERE username_hash = ?').get('user')).toEqual({
      count: 1,
    });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });

  it('returns 500 when a non-Error value is thrown', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 1,
        },
      ],
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
