import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt001', 'imdb:tt001', 'Alpha Movie', 'alpha movie', '1999', 'Plot one', 'img1.jpg', 'hash1');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt002', 'imdb:tt002', 'Beta Series', 'beta series', '2000', 'Plot two', 'img2.jpg', 'hash2');
};

describe('collection-items-search-suggestions-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns title suggestions matching query', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: 'alpha' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-search-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: expect.arrayContaining([expect.objectContaining({ label: 'Alpha Movie', kind: 'title' })]),
      })
    );
  });

  it('returns empty suggestions when query is empty', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: '' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-search-suggestions-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ suggestions: [] });
  });

  it('respects limit parameter', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { query: 'a', limit: '1' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-search-suggestions-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.suggestions.length).toBeLessThanOrEqual(1);
  });

  it('does not expose suggestions from shared private trackers', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'token');
    db.prepare(
      `INSERT INTO user_shares
        (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES ('owner', 'user', 1, 0, 0, 0)`
    ).run();
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES ('owner', 'openlibrary', '9780306406157', 'isbn:9780306406157', 'book-tracker', 'book',
          'Private Shared Book', 'private shared book', '', '', '', 'private-book')`
    ).run();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { query: 'private', listType: 'book-tracker' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-search-suggestions-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ suggestions: [] });
  });
});
