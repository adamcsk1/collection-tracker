import {
  MAX_COLLECTION_FILTER_GENRES,
  MAX_COLLECTION_FILTER_TAGS,
} from '@shared/constants/collection-filter-api-const';
import { MAX_COLLECTION_MATCHED_ITEM_IDENTITIES } from '@shared/constants/collection-matched-items-api-const';
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
  ).run('user', 'imdb', 'tt001', 'imdb:tt001', 'Alpha', 'alpha', '1999', 'Plot one', 'img1.jpg', 'hash1');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt002', 'imdb:tt002', 'Beta', 'beta', '2000', 'Plot two', 'img2.jpg', 'hash2');
};

describe('collection-items-matched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns matched items ordered by identities', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        identities: [
          { source: 'imdb', id: 'tt002' },
          { source: 'imdb', id: 'tt001' },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'Beta' }),
          expect.objectContaining({ title: 'Alpha' }),
        ]),
        total: 2,
      })
    );
  });

  it('matches items by resolved canonical identities', async () => {
    const db = getDatabase();
    db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
    db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('user', 'omdb', 'provider-item-id', 'imdb:tt001', 'Canonical Item', 'canonical item', '2001', '', '', 'hash');
    db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    ).run('user', 'imdb:tt001', 'imdb', 'tt001', 'alias');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: { identities: [{ source: 'imdb', id: 'tt001' }] },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Canonical Item' })],
        total: 1,
      })
    );
  });

  it('orders shared items by owner-scoped aliases and ignores unauthorized aliases', async () => {
    const db = getDatabase();
    const insertUser = db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)');
    const insertItem = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'omdb', ?, ?, ?, ?, '', '', '', ?)`
    );
    const insertAlias = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, 'omdb', ?, 'alias')`
    );
    const insertGrant = db.prepare(
      `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES (?, 'viewer', 'library', 'movie', 1)`
    );

    for (const usernameHash of ['viewer', 'owner-first', 'owner-second', 'owner-private']) {
      insertUser.run(usernameHash, `${usernameHash}-token`);
    }
    insertItem.run('owner-first', 'primary-first', 'custom:first', 'First Row', 'first row', 'first-hash');
    insertItem.run('owner-second', 'primary-second', 'custom:second', 'Second Row', 'second row', 'second-hash');
    insertItem.run('owner-private', 'primary-private', 'custom:private', 'Private Row', 'private row', 'private-hash');
    insertAlias.run('owner-first', 'custom:first', 'alias-first');
    insertAlias.run('owner-second', 'custom:second', 'alias-second');
    insertAlias.run('owner-private', 'custom:private', 'alias-private');
    insertGrant.run('owner-first');
    insertGrant.run('owner-second');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'viewer',
      body: {
        identities: [
          { source: 'omdb', id: 'alias-private' },
          { source: 'omdb', id: 'alias-second' },
          { source: 'omdb', id: 'alias-first' },
        ],
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ title: 'Second Row' }), expect.objectContaining({ title: 'First Row' })],
        total: 2,
      })
    );
  });

  it('returns 400 when identities are missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when identities contain invalid values', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [{ source: 'imdb', id: 'tt001' }, 42] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when identities exceed the request limit', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        identities: Array.from({ length: MAX_COLLECTION_MATCHED_ITEM_IDENTITIES + 1 }, (_, index) => ({
          source: 'imdb',
          id: `tt${index}`,
        })),
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith();
  });

  it.each([
    null,
    [],
    { tags: 'drama' },
    { tags: ['drama', 42] },
    { genres: [false] },
    { watched: 'true' },
    { type: 'podcast' },
    { tagMode: 'some' },
    { listType: 'archive' },
    { orderDirection: 'sideways' },
    { unknown: true },
  ])('returns 400 when filters are malformed: %j', async (filters) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [], filters } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith();
  });

  it.each([
    { tags: Array(MAX_COLLECTION_FILTER_TAGS + 1).fill('tag') },
    { genres: Array(MAX_COLLECTION_FILTER_GENRES + 1).fill('genre') },
  ])('returns 400 when a filter array exceeds its limit', async (filters) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [], filters } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('accepts maximum identities and filters without exceeding SQLite bind limits', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        identities: Array.from({ length: MAX_COLLECTION_MATCHED_ITEM_IDENTITIES }, (_, index) => ({
          source: 'imdb',
          id: `tt${index}`,
        })),
        filters: {
          tags: Array(MAX_COLLECTION_FILTER_TAGS).fill('tag'),
          genres: Array(MAX_COLLECTION_FILTER_GENRES).fill('genre'),
        },
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ items: [], total: 0 }));
  });

  it('returns empty when no identities match', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ items: [], total: 0 }));
  });
});
