import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('get-tag-config-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns caller tag configs', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      'INSERT INTO tag_configs (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('user', '#a', '#111111', 1, 0, 0, 1);

    const { register } = await import('./get-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([
      {
        tag: '#a',
        color: '#111111',
        useForImageBorder: true,
        useForTextColor: false,
        useForImageBadge: false,
        weight: 1,
      },
    ]);
  });

  it('returns empty array when caller has no stored tag config', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it('returns empty array when tag config storage is null', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it('returns empty array when DB has no rows', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./get-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });

  it('returns empty array when DB user is absent', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./get-tag-config-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith([]);
  });
});
