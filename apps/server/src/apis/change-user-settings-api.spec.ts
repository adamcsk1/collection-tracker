import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('change-user-settings-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body contains invalid values', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 123 }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('updates user settings and returns merged config', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 'dark' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, theme) VALUES (?, ?)').run('user', 'light');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      theme: 'dark',
    });
  });

  it('does not overwrite stored language and theme from login defaults', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 'light', language: 'en', fromLogin: true }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, theme, language) VALUES (?, ?, ?)').run('user', 'dark', 'en');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      theme: 'dark',
      language: 'en',
    });
    expect(db.prepare('SELECT theme, language FROM user_settings WHERE username_hash = ?').get('user')).toEqual({
      theme: 'dark',
      language: 'en',
    });
  });

  it('updates the default library owner share code', async () => {
    const response = mockResponse();
    const request: any = { body: { defaultLibraryOwnerShareCode: 'owner-code' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultLibraryOwnerShareCode: 'owner-code',
    });
    expect(
      db.prepare('SELECT default_library_owner_share_code FROM user_settings WHERE username_hash = ?').get('user')
    ).toEqual({
      default_library_owner_share_code: 'owner-code',
    });
  });

  it('updates collection list display preferences', async () => {
    const response = mockResponse();
    const preferences = {
      showYear: false,
      showSharedIcon: true,
      preferredRating: 'metacritic',
      imdbRatingFallback: true,
    };
    const request: any = { body: { collectionListDisplayPreferences: preferences }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ collectionListDisplayPreferences: preferences });
    expect(
      db.prepare('SELECT collection_list_display_preferences FROM user_settings WHERE username_hash = ?').get('user')
    ).toEqual({ collection_list_display_preferences: JSON.stringify(preferences) });
  });

  it('returns 400 for invalid collection list display preferences', async () => {
    const response = mockResponse();
    const request: any = {
      body: {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: true,
          preferredRating: 'letterboxd',
          imdbRatingFallback: false,
        },
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('updates collection feature preferences', async () => {
    const response = mockResponse();
    const preferences = { wishlist: false, watchLater: true, movieTracker: false, seriesTracker: true };
    const request: any = { body: { collectionFeaturePreferences: preferences }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ collectionFeaturePreferences: preferences });
    expect(
      db.prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?').get('user')
    ).toEqual({ collection_feature_preferences: JSON.stringify(preferences) });
  });

  it('returns 400 for incomplete collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = {
      body: { collectionFeaturePreferences: { wishlist: true, watchLater: true, movieTracker: true } },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts null to select my library as the default', async () => {
    const response = mockResponse();
    const request: any = { body: { defaultLibraryOwnerShareCode: null }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, default_library_owner_share_code) VALUES (?, ?)').run(
      'user',
      'owner-code'
    );

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultLibraryOwnerShareCode: null,
    });
  });

  it('returns 500 on unexpected error', async () => {
    const response = mockResponse();
    const request: any = { body: { theme: 'dark' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(500);
  });
});
