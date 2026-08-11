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
  process.env.COOKIE_SECRET = 'matched-api-secret';

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
        data: expect.arrayContaining([
          expect.objectContaining({ title: 'Beta' }),
          expect.objectContaining({ title: 'Alpha' }),
        ]),
        page: { limit: 50, hasMore: false, nextCursor: null },
      })
    );
  });

  it.each(['orderBy', 'orderDirection'])('rejects unsupported %s filters', async (filterName) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: {
        identities: [{ source: 'imdb', id: 'tt001' }],
        filters: { [filterName]: filterName === 'orderBy' ? 'alphabet' : 'asc' },
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('pages ranked matches with a signed matches cursor', async () => {
    insertUserAndItems();
    const identities = [
      { source: 'imdb' as const, id: 'tt002' },
      { source: 'imdb' as const, id: 'tt001' },
    ];
    const firstResponse = mockResponse();
    const firstRoute = buildApp({ usernameHash: 'user', body: { identities, limit: 1 } } as any, firstResponse);
    const { register } = await import('./collection-items-matched-api');
    register(firstRoute.app);
    await firstRoute.handlerPromise();
    const firstResult = firstResponse.send.mock.calls[0][0];

    expect(firstResult).toEqual({
      data: [expect.objectContaining({ title: 'Beta' })],
      page: { limit: 1, hasMore: true, nextCursor: expect.any(String) },
    });

    const secondResponse = mockResponse();
    const secondRoute = buildApp(
      { usernameHash: 'user', body: { identities, cursor: firstResult.page.nextCursor, limit: 1 } } as any,
      secondResponse
    );
    register(secondRoute.app);
    await secondRoute.handlerPromise();

    expect(secondResponse.send).toHaveBeenCalledWith({
      data: [expect.objectContaining({ title: 'Alpha' })],
      page: { limit: 1, hasMore: false, nextCursor: null },
    });
  });

  it.each([1, 100])('accepts matched page limit %s', async (limit) => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [], limit } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);
    await handlerPromise();

    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit, hasMore: false, nextCursor: null },
    });
  });

  it.each([0, -1, 1.5, 101, NaN, Infinity, '1', null, [1]])(
    'returns 400 for invalid matched page limit %j',
    async (limit) => {
      const response = mockResponse();
      const request: any = { usernameHash: 'user', body: { identities: [], limit } };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./collection-items-matched-api');
      register(app);
      await handlerPromise();

      expect(response.code).toHaveBeenCalledWith(400);
      expect(response.send).toHaveBeenCalledWith();
    }
  );

  it('paginates own and shared rows at the same first identity rank without duplicates', async () => {
    const db = getDatabase();
    const insertUser = db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)');
    const insertItem = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, 'imdb', 'tt001', ?, ?, ?, '', '', '', ?)`
    );
    insertUser.run('viewer', 'viewer-token');
    insertUser.run('owner', 'owner-token');
    insertItem.run('viewer', 'imdb:viewer-item', 'Own Row', 'own row', 'own-hash');
    insertItem.run('owner', 'imdb:owner-item', 'Shared Row', 'shared row', 'shared-hash');
    db.prepare(
      "INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES ('owner', 'viewer')"
    ).run();
    db.prepare(
      `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES ('owner', 'viewer', 'library', 'movie', 1)`
    ).run();
    const identities = [
      { source: 'imdb' as const, id: 'tt001' },
      { source: 'imdb' as const, id: 'tt002' },
      { source: 'imdb' as const, id: 'tt001' },
    ];
    const { register } = await import('./collection-items-matched-api');
    const firstResponse = mockResponse();
    const firstRoute = buildApp({ usernameHash: 'viewer', body: { identities, limit: 1 } } as any, firstResponse);
    register(firstRoute.app);
    await firstRoute.handlerPromise();
    const firstResult = firstResponse.send.mock.calls[0][0];

    const secondResponse = mockResponse();
    const secondRoute = buildApp(
      { usernameHash: 'viewer', body: { identities, cursor: firstResult.page.nextCursor, limit: 1 } } as any,
      secondResponse
    );
    register(secondRoute.app);
    await secondRoute.handlerPromise();
    const secondResult = secondResponse.send.mock.calls[0][0];

    expect(firstResult.page).toEqual({ limit: 1, hasMore: true, nextCursor: expect.any(String) });
    expect(secondResult.page).toEqual({ limit: 1, hasMore: false, nextCursor: null });
    expect([firstResult.data[0].title, secondResult.data[0].title]).toEqual(['Own Row', 'Shared Row']);
    expect(new Set([firstResult.data[0].title, secondResult.data[0].title]).size).toBe(2);
  });

  it('does not shift matched pages when a row before the cursor boundary is deleted', async () => {
    insertUserAndItems();
    getDatabase()
      .prepare(
        `INSERT INTO collection_items
          (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run('user', 'imdb', 'tt003', 'imdb:tt003', 'Gamma', 'gamma', '2001', 'Plot three', 'img3.jpg', 'hash3');
    const identities = [
      { source: 'imdb' as const, id: 'tt001' },
      { source: 'imdb' as const, id: 'tt002' },
      { source: 'imdb' as const, id: 'tt003' },
    ];
    const { register } = await import('./collection-items-matched-api');
    const firstResponse = mockResponse();
    const firstRoute = buildApp({ usernameHash: 'user', body: { identities, limit: 2 } } as any, firstResponse);
    register(firstRoute.app);
    await firstRoute.handlerPromise();
    const firstResult = firstResponse.send.mock.calls[0][0];

    getDatabase()
      .prepare("DELETE FROM collection_items WHERE username_hash = 'user' AND external_item_id = 'tt001'")
      .run();
    const secondResponse = mockResponse();
    const secondRoute = buildApp(
      { usernameHash: 'user', body: { identities, cursor: firstResult.page.nextCursor, limit: 2 } } as any,
      secondResponse
    );
    register(secondRoute.app);
    await secondRoute.handlerPromise();

    expect(firstResult.data).toEqual([
      expect.objectContaining({ title: 'Alpha' }),
      expect.objectContaining({ title: 'Beta' }),
    ]);
    expect(secondResponse.send).toHaveBeenCalledWith({
      data: [expect.objectContaining({ title: 'Gamma' })],
      page: { limit: 2, hasMore: false, nextCursor: null },
    });
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
        data: [expect.objectContaining({ title: 'Canonical Item' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
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
    const insertShare = db.prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, 'viewer')`
    );
    insertShare.run('owner-first');
    insertShare.run('owner-second');
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
        data: [expect.objectContaining({ title: 'Second Row' }), expect.objectContaining({ title: 'First Row' })],
        page: { limit: 50, hasMore: false, nextCursor: null },
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

  it('returns 400 for a malformed cursor', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: { identities: [{ source: 'imdb', id: 'tt001' }], cursor: 'invalid' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({ error: 'Invalid cursor' });
  });

  it('returns 400 for a malformed cursor when identities are empty', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [], cursor: 'invalid' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({ error: 'Invalid cursor' });
  });

  it.each(['', 'x'.repeat(4097)])('rejects invalid cursor length before database work', async (cursor) => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      body: { identities: [{ source: 'imdb', id: 'tt001' }], cursor },
    };
    const { app, handlerPromise } = buildApp(request, response);
    const prepareSpy = vi.spyOn(getDatabase(), 'prepare');

    const { register } = await import('./collection-items-matched-api');
    register(app);
    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(prepareSpy).not.toHaveBeenCalled();
    prepareSpy.mockRestore();
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
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });

  it('returns empty when no identities match', async () => {
    insertUserAndItems();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', body: { identities: [] } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-matched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      data: [],
      page: { limit: 50, hasMore: false, nextCursor: null },
    });
  });
});
