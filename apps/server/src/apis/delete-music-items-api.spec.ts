import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('delete-music-items-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('deletes only current user music list items', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('other', 'token');
    const insert = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'musicbrainz', ?, ?, ?, 'album', 'Album', 'album', '', '', '', ?)`
    );
    insert.run(
      'user',
      'f509c5ff-ad54-4dde-b61e-24f750965835',
      'musicbrainz:f509c5ff-ad54-4dde-b61e-24f750965835',
      'music',
      'user-tracker'
    );
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES ('user', 'imdb', 'tt001', 'imdb:tt001', 'library', 'movie', 'Movie', 'movie', '', '', '', 'user-library')`
    ).run();
    insert.run(
      'other',
      'f509c5ff-ad54-4dde-b61e-24f750965835',
      'musicbrainz:f509c5ff-ad54-4dde-b61e-24f750965835',
      'music',
      'other-tracker'
    );
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user' }, response);

    const { register } = await import('./delete-music-items-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      db.prepare('SELECT username_hash, list_type FROM collection_items ORDER BY username_hash, list_type').all()
    ).toEqual([
      { username_hash: 'other', list_type: 'music' },
      { username_hash: 'user', list_type: 'library' },
    ]);
  });
});
