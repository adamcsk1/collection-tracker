import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('get-user-settings-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns caller user settings', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      'INSERT INTO user_settings (username_hash, theme, animated_background, language) VALUES (?, ?, ?, ?)'
    ).run('user', 'dark', 0, 'en');

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      theme: 'dark',
      animatedBackground: false,
      language: 'en',
    });
  });

  it('returns the configured default library owner share code', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, default_library_owner_share_code) VALUES (?, ?)').run(
      'user',
      'owner-code'
    );

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultLibraryOwnerShareCode: 'owner-code',
    });
  });

  it('returns collection list display preferences', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    const preferences = {
      showYear: false,
      showSharedIcon: true,
      preferredRating: 'rottenTomatoes',
      imdbRatingFallback: true,
    };
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, collection_list_display_preferences) VALUES (?, ?)').run(
      'user',
      JSON.stringify(preferences)
    );

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ collectionListDisplayPreferences: preferences });
  });

  it('returns empty object when caller has no stored user settings', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({});
  });

  it('returns empty object when caller has no DB row', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({});
  });
});
