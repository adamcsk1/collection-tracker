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

  it('updates an exact-scope default collection owner with Add permission', async () => {
    const response = mockResponse();
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'token');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const ownerCode = getUserShareCode('owner');
    db.prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)').run(
      'owner',
      'user'
    );
    db.prepare(
      `INSERT INTO user_share_grants
       (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, can_create, can_update, can_delete, scope_mode)
       VALUES (?, ?, ?, ?, 1, 1, 0, 0, 'all')`
    ).run('owner', 'user', 'wishlist', 'movie');
    const defaults = [{ listType: 'wishlist', contentType: 'movie', ownerUserShareCode: ownerCode }];
    const request: any = { body: { defaultCollectionOwners: defaults }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultCollectionOwners: defaults,
    });
    expect(
      db
        .prepare(
          'SELECT list_type, content_type, owner_username_hash FROM collection_owner_defaults WHERE username_hash = ?'
        )
        .get('user')
    ).toEqual({
      list_type: 'wishlist',
      content_type: 'movie',
      owner_username_hash: 'owner',
    });
  });

  it('rejects a default collection owner without exact Add permission', async () => {
    const response = mockResponse();
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'token');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      body: {
        defaultCollectionOwners: [
          { listType: 'library', contentType: 'series', ownerUserShareCode: getUserShareCode('owner') },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('rejects the caller as a default collection owner', async () => {
    const response = mockResponse();
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const request: any = {
      body: {
        defaultCollectionOwners: [
          { listType: 'library', contentType: 'movie', ownerUserShareCode: getUserShareCode('user') },
        ],
      },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
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
    const preferences = {
      books: true,
      wishlist: false,
      upNext: true,
      tracking: true,
    };
    const request: any = { body: { collectionFeaturePreferences: preferences }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ collectionFeaturePreferences: { ...preferences, music: true } });
    const stored = db
      .prepare('SELECT collection_feature_preferences FROM user_settings WHERE username_hash = ?')
      .get('user') as { collection_feature_preferences: string };
    expect(JSON.parse(stored.collection_feature_preferences)).toEqual({ ...preferences, music: true });
  });

  it('returns 400 for incomplete collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = {
      body: { collectionFeaturePreferences: { wishlist: true, upNext: true, tracking: true } },
      usernameHash: 'user',
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts an empty array to select own collections by default', async () => {
    const response = mockResponse();
    const request: any = { body: { defaultCollectionOwners: [] }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');

    const { register } = await import('./change-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultCollectionOwners: [],
    });
  });
});
