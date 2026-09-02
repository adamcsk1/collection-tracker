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

const insertAlbumItem = (
  albumId: string,
  listType = 'music',
  usernameHash = 'user',
  progressCurrent: number | null = null,
  progressTotal: number | null = null
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, 'musicbrainz', ?, ?, ?, 'Album Title', 'album title', '', '', '', ?, 'album')`
    )
    .run(usernameHash, albumId, `musicbrainz:${albumId}`, listType, `${usernameHash}-${listType}-${albumId}`);
  const itemId = Number(result.lastInsertRowid);
  if (listType === 'tracking') {
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
       VALUES (?, CURRENT_TIMESTAMP, ?, ?)`
    ).run(itemId, progressCurrent, progressTotal);
  }
  return itemId;
};

describe('mark-all-music-uncompleted-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uncompletes only current user music albums while preserving tracking rows and progress', async () => {
    insertUser();
    insertUser('other-user');
    insertAlbumItem('own-album');
    insertAlbumItem('other-album', 'music', 'other-user');
    const ownTrackerId = insertAlbumItem('own-album', 'tracking', 'user', 4, 10);
    const otherTrackerId = insertAlbumItem('other-album', 'tracking', 'user', 2, 8);
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'user' }, response);
    const { register } = await import('./mark-all-music-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase()
        .prepare(
          'SELECT item_id, completed_at, progress_current, progress_total FROM collection_item_tracker_state ORDER BY item_id'
        )
        .all()
    ).toEqual([
      { item_id: ownTrackerId, completed_at: null, progress_current: 4, progress_total: 10 },
      { item_id: otherTrackerId, completed_at: expect.any(String), progress_current: 2, progress_total: 8 },
    ]);
  });

  it('uncompletes albums from a readable all shared music list', async () => {
    insertUser();
    insertUser('owner');
    insertAlbumItem('shared-album', 'music', 'owner');
    insertAlbumItem('own-album');
    const sharedTrackerId = insertAlbumItem('shared-album', 'tracking', 'user');
    const ownTrackerId = insertAlbumItem('own-album', 'tracking', 'user');
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
    const { register } = await import('./mark-all-music-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase().prepare('SELECT item_id, completed_at FROM collection_item_tracker_state ORDER BY item_id').all()
    ).toEqual([
      { item_id: sharedTrackerId, completed_at: null },
      { item_id: ownTrackerId, completed_at: expect.any(String) },
    ]);
  });

  it('uncompletes only explicitly selected shared albums', async () => {
    insertUser();
    insertUser('owner');
    const selectedItemId = insertAlbumItem('selected-album', 'music', 'owner');
    insertAlbumItem('hidden-album', 'music', 'owner');
    const selectedTrackerId = insertAlbumItem('selected-album', 'tracking', 'user');
    const hiddenTrackerId = insertAlbumItem('hidden-album', 'tracking', 'user');
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
    const { register } = await import('./mark-all-music-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });
    expect(
      getDatabase().prepare('SELECT item_id, completed_at FROM collection_item_tracker_state ORDER BY item_id').all()
    ).toEqual([
      { item_id: selectedTrackerId, completed_at: null },
      { item_id: hiddenTrackerId, completed_at: expect.any(String) },
    ]);
  });

  it('returns 403 when the user cannot read the shared music list', async () => {
    insertUser();
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertAlbumItem('shared-album', 'music', 'owner');
    const trackerId = insertAlbumItem('shared-album', 'tracking', 'user');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } },
      response
    );
    const { register } = await import('./mark-all-music-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();
    expect(
      getDatabase().prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?').get(trackerId)
    ).toEqual({ completed_at: expect.any(String) });
  });

  it('returns 404 when the shared music owner is missing', async () => {
    insertUser();
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      { usernameHash: 'user', query: { ownerShareCode: 'missing-owner-code' } },
      response
    );
    const { register } = await import('./mark-all-music-uncompleted-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith();
  });
});
