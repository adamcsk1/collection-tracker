import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  copySeriesToTracking,
  deleteAllTrackingItems,
  findOwnTrackingItems,
  findTrackingItemsForLibrarySeries,
  markAllSeriesAsCompleted,
} from './tracking-series-repository';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  usernameHash: string,
  imdbId: string | null,
  tags: string[],
  listType = 'library',
  overrides: Partial<{
    title: string;
    year: string;
    contributors: string;
    description: string;
    image: string;
    contentHash: string;
    contentType: string;
    externalProvider: string;
    externalItemId: string;
    canonicalItemId: string;
  }> = {}
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, contributors, description, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      overrides.externalProvider ?? 'omdb',
      overrides.externalItemId ?? imdbId,
      overrides.canonicalItemId ??
        (imdbId ? `imdb:${imdbId}` : `${overrides.externalProvider ?? 'omdb'}:${overrides.externalItemId ?? imdbId}`),
      listType,
      overrides.title ?? 'Title',
      overrides.title?.toLowerCase() ?? 'title',
      overrides.year ?? '',
      overrides.contributors ?? '',
      overrides.description ?? '',
      overrides.image ?? '',
      overrides.contentHash ?? `${usernameHash}-${listType}-${imdbId}`,
      overrides.contentType ?? 'series'
    );
  const itemId = Number(result.lastInsertRowid);
  if (imdbId) {
    db.prepare(
      `INSERT OR IGNORE INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, 'imdb', ?, 'primary')`
    ).run(usernameHash, overrides.canonicalItemId ?? `imdb:${imdbId}`, imdbId);
  }
  if (listType === 'tracking') {
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, NULL)').run(itemId);
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  return itemId;
};

const insertShare = (ownerHash: string, sharedWithHash: string, canRead: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, canRead ? 1 : 0, 0, 0, 0);
};

describe('watching-repository', () => {
  it('copies an own library series to tracking', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#action']);
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toEqual(
      expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'series',
        tags: ['#action', '#series'],
      })
    );
    const trackerRow = db
      .prepare(
        `SELECT collection_items.list_type, tracker_state.completed_at
         FROM collection_items
         INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
         WHERE collection_items.username_hash = ? AND collection_items.external_provider = ?
           AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
      )
      .get('user', 'omdb', 'tt-1', 'tracking') as { list_type: string; completed_at: string | null } | undefined;
    expect(trackerRow?.list_type).toBe('tracking');
    expect(trackerRow?.completed_at).toBeNull();
  });

  it('returns existing tracker item when already present (idempotent)', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-1', ['#series'], 'tracking');
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('returns existing tracker item by provider identity when legacy IMDb IDs differ', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', { externalItemId: 'provider-series-1' });
    insertItem('user', 'tt-tracker', ['#series'], 'tracking', { externalItemId: 'provider-series-1' });
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-library', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-tracker', listType: 'tracking' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'provider-series-1', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('returns existing tracker item by canonical identity when providers differ', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-library', 'library');

    expect(result).toEqual(expect.objectContaining({ canonicalItemId: 'imdb:tt-same', listType: 'tracking' }));
    const count = db
      .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .get('user', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('preserves former system tags as custom tags and keeps the series content type', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#completed', '#favorite', '#watchlist', '#wishlist', '#action']);
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toBeTruthy();
    expect(result!.contentType).toBe('series');
    expect(result!.tags).toContain('#action');
    expect(result!.tags).toContain('#completed');
    expect(result!.tags).toContain('#favorite');
    expect(result!.tags).toContain('#watchlist');
    expect(result!.tags).toContain('#wishlist');
  });

  it('deletes source item when deleteSource is true', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'up-next');
    const db = getDatabase();

    copySeriesToTracking(db, 'user', 'user', 'tt-1', 'up-next', true);

    const source = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'up-next');
    expect(source).toBeUndefined();
  });

  it('returns null when source item is missing', () => {
    insertUser('user');
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-missing', 'library');

    expect(result).toBeNull();
  });

  it('returns null when source item is not a series', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'library', { contentType: 'movie' });
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toBeNull();
  });

  it('copies from a readable shared library to requester tracking', () => {
    insertUser('owner');
    insertUser('viewer');
    insertShare('owner', 'viewer', true);
    insertItem('owner', 'tt-1', ['#series']);
    const db = getDatabase();

    const result = copySeriesToTracking(db, 'viewer', 'owner', 'tt-1', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }));
    const viewerTracker = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('viewer', 'omdb', 'tt-1', 'tracking');
    expect(viewerTracker).toBeTruthy();
  });

  it('markAllSeriesAsCompleted copies unwatched library series to tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-2', ['#movie'], 'library', { contentType: 'movie' });
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }));
  });

  it('markAllSeriesAsCompleted skips items already in tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-1', ['#series'], 'tracking');
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'user');

    expect(result).toHaveLength(0);
  });

  it('markAllSeriesAsCompleted skips items already in tracker by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'user');

    expect(result).toHaveLength(0);
  });

  it('markAllSeriesAsCompleted copies from readable shared library', () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('owner', 'tt-shared', ['#series']);
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'owner');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ IMDbId: 'tt-shared', listType: 'tracking' }));
  });

  it('markAllSeriesAsCompleted copies provider-only library series', () => {
    insertUser('user');
    insertItem('user', null, ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      contentHash: 'provider-series-library',
    });
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ IMDbId: undefined, externalProvider: 'omdb', externalItemId: 'series-1' })
    );
    expect(
      db
        .prepare(
          'SELECT external_item_id, list_type FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
        )
        .get('user', 'omdb', 'series-1', 'tracking')
    ).toEqual({ external_item_id: 'series-1', list_type: 'tracking' });
  });

  it('markAllSeriesAsCompleted returns empty array when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const result = markAllSeriesAsCompleted(db, 'user', 'user');

    expect(result).toEqual([]);
  });

  it('findTrackingItemsForLibrarySeries returns tracker items with corresponding library series', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');
    insertItem('user', 'tt-1', ['#series'], 'tracking');
    insertItem('user', 'tt-2', ['#series'], 'tracking');
    const db = getDatabase();

    const result = findTrackingItemsForLibrarySeries(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0].IMDbId).toBe('tt-1');
  });

  it('findTrackingItemsForLibrarySeries matches corresponding library series by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = findTrackingItemsForLibrarySeries(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0].canonicalItemId).toBe('imdb:tt-same');
  });

  it('findOwnTrackingItems returns only own tracker items', () => {
    insertUser('user');
    insertUser('other');
    insertItem('user', 'tt-1', ['#series'], 'tracking');
    insertItem('other', 'tt-2', ['#series'], 'tracking');
    const db = getDatabase();

    const result = findOwnTrackingItems(db, 'user');

    expect(result).toHaveLength(1);
    expect(result[0].IMDbId).toBe('tt-1');
  });

  it('deleteAllTrackingItems removes all current user tracker items', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'tracking');
    insertItem('user', 'tt-2', ['#series'], 'tracking');
    insertItem('user', 'tt-3', ['#series'], 'library');
    const db = getDatabase();

    const changedCount = deleteAllTrackingItems(db, 'user');

    expect(changedCount).toBe(2);
    const rows = db
      .prepare('SELECT external_item_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .all('user', 'tracking') as { external_item_id: string }[];
    expect(rows).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM collection_item_tracker_state').get()).toEqual({ count: 0 });
    expect(
      db
        .prepare(
          'SELECT canonical_item_id FROM external_item_identities WHERE username_hash = ? ORDER BY canonical_item_id'
        )
        .all('user')
    ).toEqual([{ canonical_item_id: 'imdb:tt-3' }]);
  });
});
