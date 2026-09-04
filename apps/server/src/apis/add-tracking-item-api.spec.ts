import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { insertLibraryShare, insertShare } from '../../test/mocks/share-mock';
import { replaceCollectionItemSelections, upsertShare } from '../core/database/repositories/share-repository';
import type { CollectionItemRow } from '../core/database/repositories/collection/collection-model';
import { metadataServiceResponse } from '../../test/mocks/metadata-service-response-mock';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  usernameHash: string,
  imdbId: string,
  tags: string[],
  listType = 'up-next',
  contentType = 'series'
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, 'omdb', imdbId, `omdb:${imdbId}`, listType, 'Title', 'title', '', '', '', 'hash', contentType);
  const itemId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT OR IGNORE INTO external_item_identities
      (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
     VALUES (?, ?, ?, ?, ?)`
  ).run(usernameHash, `omdb:${imdbId}`, 'imdb', imdbId, 'alias');
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, ?)').run(itemId, null);
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
};

describe('add-tracking-item-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.OMDB_API_KEY;
  });

  it('moves an own watch later series to tracking and fetches metadata', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }))
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#watchlist']);

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'up-next' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'series',
        tags: ['#series', '#watchlist'],
      }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'up-next')
    ).toBeUndefined();
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracking_seasons.season, series_tracking_seasons.episodes
           FROM series_tracking_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracking_seasons.item_id
            WHERE collection_items.external_item_id = ?`
        )
        .all('tt-1')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'tmdb', externalIdentityId: '603' },
      query: { sourceListType: 'up-next' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('copies an own library series to tracking and fetches metadata', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }))
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: {},
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'series',
        tags: ['#series'],
      }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'library')
    ).toEqual({ 1: 1 });
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracking_seasons.season, series_tracking_seasons.episodes
           FROM series_tracking_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracking_seasons.item_id
            WHERE collection_items.external_item_id = ? AND collection_items.list_type = ?`
        )
        .all('tt-1', 'tracking')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('fetches series metadata by default when the query flag is omitted', async () => {
    process.env.OMDB_API_KEY = 'key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(metadataServiceResponse({ seasons: [{ season: 1, episodes: 2 }] }))
    );
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: {},
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(
      getDatabase()
        .prepare(
          `SELECT series_tracking_seasons.season, series_tracking_seasons.episodes
           FROM series_tracking_seasons
           INNER JOIN collection_items ON collection_items.id = series_tracking_seasons.item_id
            WHERE collection_items.external_item_id = ? AND collection_items.list_type = ?`
        )
        .all('tt-1', 'tracking')
    ).toEqual([{ season: 1, episodes: 2 }]);
  });

  it('copies a readable shared library series and keeps the shared source item', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertItem('owner', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }),
    });
    expect(
      getDatabase()
        .prepare(
          'SELECT username_hash, list_type FROM collection_items WHERE external_item_id = ? ORDER BY username_hash'
        )
        .all('tt-1')
    ).toEqual([
      { username_hash: 'owner', list_type: 'library' },
      { username_hash: 'user', list_type: 'tracking' },
    ]);
  });

  it('copies a selected shared source and rejects an unselected sibling', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-1', ['#series'], 'library');
    insertItem('owner', 'tt-2', ['#series'], 'library');
    upsertShare(getDatabase(), 'owner', 'user', []);
    const selectedItem = getDatabase()
      .prepare("SELECT * FROM collection_items WHERE username_hash = 'owner' AND external_item_id = 'tt-1'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'user',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    const { register } = await import('./add-tracking-item-api');

    const selectedResponse = mockResponse();
    const selectedApp = buildApp(
      {
        usernameHash: 'user',
        params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
        query: { ownerShareCode: getUserShareCode('owner') },
      },
      selectedResponse
    );
    register(selectedApp.app);
    await selectedApp.handlerPromise();
    expect(selectedResponse.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ externalItemId: 'tt-1', listType: 'tracking' }),
    });

    const hiddenResponse = mockResponse();
    const hiddenApp = buildApp(
      {
        usernameHash: 'user',
        params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-2' },
        query: { ownerShareCode: getUserShareCode('owner') },
      },
      hiddenResponse
    );
    register(hiddenApp.app);
    await hiddenApp.handlerPromise();
    expect(hiddenResponse.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when copying from a shared library without read permission', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: false });
    insertItem('owner', 'tt-1', ['#series'], 'library');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
  });

  it('moves a watchlist movie to tracking', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#watchlist'], 'up-next', 'movie');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'up-next' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking', contentType: 'movie' }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'up-next')
    ).toBeUndefined();
  });

  it('copies an own music album to tracking as uncompleted', async () => {
    insertUser('user');
    insertItem('user', 'album-1', ['#album'], 'music', 'album');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'album-1' },
      query: { sourceListType: 'music', markCompleted: false },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({
        externalItemId: 'album-1',
        listType: 'tracking',
        contentType: 'album',
        watched: false,
      }),
    });
    expect(
      getDatabase()
        .prepare(
          'SELECT list_type FROM collection_items WHERE username_hash = ? AND external_item_id = ? ORDER BY list_type'
        )
        .all('user', 'album-1')
    ).toEqual([{ list_type: 'music' }, { list_type: 'tracking' }]);
  });

  it('copies a readable shared music album to requester tracking as uncompleted', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare(getDatabase(), 'owner', 'user', [
      {
        listType: 'music',
        contentType: 'album',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    insertItem('owner', 'album-1', ['#album'], 'music', 'album');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'album-1' },
      query: { sourceListType: 'music', ownerShareCode: getUserShareCode('owner'), markCompleted: false },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ externalItemId: 'album-1', listType: 'tracking', watched: false }),
    });
    expect(
      getDatabase()
        .prepare(
          'SELECT username_hash, list_type FROM collection_items WHERE external_item_id = ? ORDER BY username_hash'
        )
        .all('album-1')
    ).toEqual([
      { username_hash: 'owner', list_type: 'music' },
      { username_hash: 'user', list_type: 'tracking' },
    ]);
  });

  it('moves an own up-next album to tracking as uncompleted', async () => {
    insertUser('user');
    insertItem('user', 'album-1', ['#album'], 'up-next', 'album');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'album-1' },
      query: { sourceListType: 'up-next', markCompleted: false },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ externalItemId: 'album-1', listType: 'tracking', watched: false }),
    });
    expect(
      getDatabase()
        .prepare('SELECT list_type FROM collection_items WHERE username_hash = ? AND external_item_id = ?')
        .all('user', 'album-1')
    ).toEqual([{ list_type: 'tracking' }]);
  });

  it('removes watch later series when it already exists in tracking', async () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#watchlist']);
    insertItem('user', 'tt-1', ['#series'], 'tracking');

    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      params: { externalIdentitySource: 'omdb', externalIdentityId: 'tt-1' },
      query: { sourceListType: 'up-next' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./add-tracking-item-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({
      item: expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }),
    });
    expect(
      getDatabase()
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', 'tt-1', 'up-next')
    ).toBeUndefined();
  });
});
