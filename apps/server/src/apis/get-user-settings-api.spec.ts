import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUserShareCode } from '../core/database/repositories/user-repository';

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

  it('returns configured exact-scope default collection owners', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'owner-token');
    db.prepare('INSERT INTO user_settings (username_hash) VALUES (?)').run('user');
    db.prepare(
      `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
       VALUES (?, ?, ?, ?)`
    ).run('user', 'tracking', 'series', 'owner');

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      defaultCollectionOwners: [
        { listType: 'tracking', contentType: 'series', ownerUserShareCode: getUserShareCode('owner') },
      ],
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

  it('returns collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    const preferences = {
      books: true,
      wishlist: false,
      upNext: true,
      tracking: true,
    };
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, collection_feature_preferences) VALUES (?, ?)').run(
      'user',
      JSON.stringify(preferences)
    );

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ collectionFeaturePreferences: { ...preferences, music: true } });
  });

  it('omits malformed stored collection feature preferences', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO user_settings (username_hash, collection_feature_preferences) VALUES (?, ?)').run(
      'user',
      '{invalid'
    );

    const { register } = await import('./get-user-settings-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({});
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
