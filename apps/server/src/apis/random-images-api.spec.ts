import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUserAndItems = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  for (let i = 1; i <= 3; i++) {
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'omdb', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', `tt00${i}`, `imdb:tt00${i}`, `Item ${i}`, `item ${i}`, '1999', 'Plot', `img${i}.jpg`, `hash${i}`);
  }
};

describe('random-images-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns random images', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { count: '2' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images).toBeInstanceOf(Array);
    expect(result.images.length).toBeLessThanOrEqual(2);
  });

  it('defaults count to 10', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images.length).toBeLessThanOrEqual(3);
  });

  it('caps count at 50', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { count: '100' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./random-images-api');
    register(app);

    await handlerPromise();
    const result = response.send.mock.calls[0][0];
    expect(result.images.length).toBeLessThanOrEqual(3);
  });

  it('includes own book tracker and readable libraries but excludes shared trackers', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('owner', 'token');
    db.prepare(
      `INSERT INTO user_shares
        (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES ('owner', 'user', 1, 0, 0, 0)`
    ).run();
    const insert = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'openlibrary', ?, ?, ?, 'book', 'Book', 'book', '', '', ?, ?)`
    );
    insert.run('user', '9780306406157', 'isbn:9780306406157', 'book-tracker', 'own-tracker.jpg', 'own-tracker');
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type, title, title_lower, year, description, image, content_hash)
       VALUES ('owner', 'omdb', 'tt001', 'imdb:tt001', 'library', 'movie', 'Movie', 'movie', '', '', 'shared-library.jpg', 'shared-library')`
    ).run();
    insert.run('owner', '9780140328721', 'isbn:9780140328721', 'book-tracker', 'shared-tracker.jpg', 'shared-tracker');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user', query: { count: '10' } }, response);

    const { register } = await import('./random-images-api');
    register(app);
    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({
      images: expect.arrayContaining(['own-tracker.jpg', 'shared-library.jpg']),
    });
    expect(response.send.mock.calls[0][0].images).not.toContain('shared-tracker.jpg');
  });
});
