import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';
import { replaceCollectionItemSelections, upsertShare } from '../core/database/repositories/share-repository';
import type { CollectionItemRow } from '../core/database/repositories/collection/collection-model';

const insertUserAndItem = () => {
  const db = getDatabase();
  db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
  db.prepare(
    `INSERT INTO collection_items
      (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('user', 'imdb', 'tt001', 'imdb:tt001', 'Item', 'item', '1999', 'Plot', 'img.jpg', 'hash');
};

const insertUser = (usernameHash: string) => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (usernameHash: string, imdbId: string) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'imdb',
      imdbId,
      `imdb:${imdbId}`,
      'Shared Item',
      'shared item',
      '1999',
      'Plot',
      'img.jpg',
      'hash'
    );
};

const insertCanonicalItem = (
  usernameHash: string,
  provider: string,
  externalItemId: string,
  canonicalItemId: string
) => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'omdb',
      externalItemId,
      canonicalItemId,
      'Canonical Item',
      'canonical item',
      '1999',
      'Plot',
      'img.jpg',
      'hash'
    );
  getDatabase()
    .prepare(
      `INSERT INTO external_item_identities (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(usernameHash, canonicalItemId, provider, externalItemId, 'alias');
};

const insertTypedItem = (usernameHash: string, imdbId: string, listType: 'up-next' | 'wishlist') => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      'imdb',
      imdbId,
      `imdb:${imdbId}`,
      listType,
      'Saved Item',
      'saved item',
      '1999',
      'Plot',
      'img.jpg',
      'hash'
    );
};

describe('collection-items-exists-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns true when item exists', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt001' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('returns true when item exists by external identity', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { externalIdentitySource: 'omdb', externalIdentityId: 'tt001' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('returns true when submitted external IDs resolve to an existing canonical item', async () => {
    insertUser('user');
    insertCanonicalItem('user', 'imdb', 'tt001', 'imdb:tt001');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: {
        externalIdentitySource: 'omdb',
        externalIdentityId: 'tt-omdb',
        externalIds: JSON.stringify([{ source: 'imdb', id: 'tt001' }]),
      },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('returns false when provider-only identities do not share a canonical item', async () => {
    insertUser('user');
    insertCanonicalItem('user', 'omdb', 'tt001', 'imdb:tt001');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { externalIdentitySource: 'imdb', externalIdentityId: 'tt123' },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: false, hash: undefined });
  });

  it('returns false when item does not exist', async () => {
    insertUserAndItem();
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt999' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: false, hash: undefined });
  });

  it('checks watch later existence using listType', async () => {
    insertUser('user');
    insertTypedItem('user', 'tt001', 'up-next');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt001', listType: 'up-next' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('checks wishlist existence using listType', async () => {
    insertUser('user');
    insertTypedItem('user', 'tt001', 'wishlist');
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt001', listType: 'wishlist' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('returns true when a shared normal item exists', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-shared');
    insertLibraryShare(getDatabase(), 'owner', 'user');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { imdbId: 'tt-shared', ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });
  });

  it('returns selected item existence and denies an unselected sibling', async () => {
    insertUser('user');
    insertUser('owner');
    insertItem('owner', 'tt-selected');
    insertItem('owner', 'tt-hidden');
    upsertShare(getDatabase(), 'owner', 'user', []);
    const selectedItem = getDatabase()
      .prepare("SELECT * FROM collection_items WHERE external_item_id = 'tt-selected'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'user',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const { register } = await import('./collection-items-exists-api');

    const selectedResponse = mockResponse();
    const selectedApp = buildApp(
      {
        usernameHash: 'user',
        query: { imdbId: 'tt-selected', ownerShareCode: getUserShareCode('owner') },
      },
      selectedResponse
    );
    register(selectedApp.app);
    await selectedApp.handlerPromise();
    expect(selectedResponse.send).toHaveBeenCalledWith({ exists: true, hash: 'hash' });

    const hiddenResponse = mockResponse();
    const hiddenApp = buildApp(
      {
        usernameHash: 'user',
        query: { imdbId: 'tt-hidden', ownerShareCode: getUserShareCode('owner') },
      },
      hiddenResponse
    );
    register(hiddenApp.app);
    await hiddenApp.handlerPromise();
    expect(hiddenResponse.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when a shared up-next item exists without up-next grant', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('owner', 'tt-watchlist', 'up-next');
    insertLibraryShare(getDatabase(), 'owner', 'user');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { imdbId: 'tt-watchlist', listType: 'up-next', ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 403 when a shared wishlist item exists without wishlist grant', async () => {
    insertUser('user');
    insertUser('owner');
    insertTypedItem('owner', 'tt-wishlist', 'wishlist');
    insertLibraryShare(getDatabase(), 'owner', 'user');
    const { getUserShareCode } = await import('../core/database/repositories/user-repository');
    const response = mockResponse();
    const request: any = {
      usernameHash: 'user',
      query: { imdbId: 'tt-wishlist', listType: 'wishlist', ownerShareCode: getUserShareCode('owner') },
    };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
  });

  it('returns 400 when imdbId is missing', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: {} };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when imdbId is empty string', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: '  ' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when external identity is partial even with an imdbId fallback', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { imdbId: 'tt001', externalIdentitySource: 'omdb' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when external provider is unsupported', async () => {
    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { externalIdentitySource: 'tmdb', externalIdentityId: '603' } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./collection-items-exists-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });
});
