import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare, insertShare } from '../../test/mocks/share-mock';
import { getDatabase } from '../core/database/database';
import type { CollectionItemRow } from '../core/database/repositories/collection/collection-model';
import { replaceCollectionItemSelections, upsertShare } from '../core/database/repositories/share-repository';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertAlbumItem = (albumId: string, listType = 'music', usernameHash = 'user') => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, 'musicbrainz', ?, ?, ?, 'Album Title', 'album title', '', '', '', ?, 'album')`
    )
    .run(usernameHash, albumId, `musicbrainz:${albumId}`, listType, `${usernameHash}-${listType}-${albumId}`);
  return Number(result.lastInsertRowid);
};

describe('mark-all-music-completed-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('completes only albums from the current user music list', async () => {
    insertUser();
    insertUser('other-user');
    insertAlbumItem('own-album');
    insertAlbumItem('other-album', 'music', 'other-user');

    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user' }, response);
    const { register } = await import('./mark-all-music-completed-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare(
          "SELECT external_item_id FROM collection_items WHERE username_hash = 'user' AND list_type = 'tracking'"
        )
        .all()
    ).toEqual([{ external_item_id: 'own-album' }]);
  });

  it('completes albums from a readable all shared music list', async () => {
    insertUser();
    insertUser('owner');
    insertAlbumItem('own-album');
    insertAlbumItem('shared-album', 'music', 'owner');
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
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } },
      response
    );
    const { register } = await import('./mark-all-music-completed-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare(
          "SELECT external_item_id FROM collection_items WHERE username_hash = 'user' AND list_type = 'tracking'"
        )
        .all()
    ).toEqual([{ external_item_id: 'shared-album' }]);
  });

  it('completes only explicitly selected shared albums', async () => {
    insertUser();
    insertUser('owner');
    const selectedItemId = insertAlbumItem('selected-album', 'music', 'owner');
    insertAlbumItem('hidden-album', 'music', 'owner');
    upsertShare(getDatabase(), 'owner', 'user', []);
    const selectedItem = getDatabase()
      .prepare('SELECT * FROM collection_items WHERE id = ?')
      .get(selectedItemId) as CollectionItemRow;
    replaceCollectionItemSelections(getDatabase(), 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'user',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } },
      response
    );
    const { register } = await import('./mark-all-music-completed-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare(
          "SELECT external_item_id FROM collection_items WHERE username_hash = 'user' AND list_type = 'tracking'"
        )
        .all()
    ).toEqual([{ external_item_id: 'selected-album' }]);
  });

  it('returns 403 when the user cannot read the shared music list', async () => {
    insertUser();
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertAlbumItem('shared-album', 'music', 'owner');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } },
      response
    );
    const { register } = await import('./mark-all-music-completed-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
    expect(getDatabase().prepare("SELECT 1 FROM collection_items WHERE list_type = 'tracking'").all()).toEqual([]);
  });

  it('returns 404 when the shared music owner is missing', async () => {
    insertUser();
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } },
      response
    );
    const { register } = await import('./mark-all-music-completed-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith();
  });
});
