import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('update-tag-management-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body is not an array', async () => {
    const response = mockResponse();
    const request: any = { body: { tag: '#a' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./update-tag-management-api');
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

    const { register } = await import('./update-tag-management-api');
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

    const { register } = await import('./update-tag-management-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts former system tag management', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#favorite',
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
    getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./update-tag-management-api');
    register(app);

    await handlerPromise();
    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(request.body);
  });

  it('updates user tag management and returns updated entries', async () => {
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

    const { register } = await import('./update-tag-management-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(request.body);
    expect(db.prepare('SELECT COUNT(*) as count FROM tag_configs WHERE username_hash = ?').get('user')).toEqual({
      count: 1,
    });
  });

  it('accepts null color values', async () => {
    const response = mockResponse();
    const request: any = {
      body: [
        {
          tag: '#a',
          color: null,
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

    const { register } = await import('./update-tag-management-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(request.body);
  });
});
