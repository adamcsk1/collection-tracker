import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  copySeriesToSeriesTracker,
  deleteAllSeriesTrackerItems,
  findOwnSeriesTrackerItems,
  findSeriesTrackerItemsForLibrarySeries,
  markAllSeriesAsWatched,
} from './series-tracker-repository';

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
    rate: string;
    plot: string;
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
      `INSERT INTO collection_items (username_hash, imdb_id, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, rate, plot, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      imdbId,
      overrides.externalProvider ?? 'omdb',
      overrides.externalItemId ?? imdbId,
      overrides.canonicalItemId ??
        (imdbId ? `imdb:${imdbId}` : `${overrides.externalProvider ?? 'omdb'}:${overrides.externalItemId ?? imdbId}`),
      listType,
      overrides.title ?? 'Title',
      overrides.title?.toLowerCase() ?? 'title',
      overrides.year ?? '',
      overrides.rate ?? '',
      overrides.plot ?? '',
      overrides.image ?? '',
      overrides.contentHash ?? `${usernameHash}-${listType}-${imdbId}`,
      overrides.contentType ?? 'series'
    );
  const itemId = Number(result.lastInsertRowid);
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

describe('series-tracker-repository', () => {
  it('copies an own library series to the series tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#action']);
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toEqual(
      expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'series-tracker',
        contentType: 'series',
        tags: ['#action', '#series'],
      })
    );
    const trackerRow = db
      .prepare('SELECT list_type FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'series-tracker') as { list_type: string } | undefined;
    expect(trackerRow?.list_type).toBe('series-tracker');
  });

  it('returns existing tracker item when already present (idempotent)', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-1', ['#series'], 'series-tracker');
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'series-tracker' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?'
      )
      .get('user', 'tt-1', 'series-tracker') as { count: number };
    expect(count.count).toBe(1);
  });

  it('returns existing tracker item by provider identity when legacy IMDb IDs differ', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', { externalItemId: 'provider-series-1' });
    insertItem('user', 'tt-tracker', ['#series'], 'series-tracker', { externalItemId: 'provider-series-1' });
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-library', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-tracker', listType: 'series-tracker' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'provider-series-1', 'series-tracker') as { count: number };
    expect(count.count).toBe(1);
  });

  it('returns existing tracker item by canonical identity when providers differ', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'series-tracker', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-library', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-tracker', listType: 'series-tracker' }));
    const count = db
      .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .get('user', 'series-tracker') as { count: number };
    expect(count.count).toBe(1);
  });

  it('preserves former system tags as custom tags and keeps the series content type', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series', '#completed', '#favorite', '#watch-later', '#wishlist', '#action']);
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toBeTruthy();
    expect(result!.contentType).toBe('series');
    expect(result!.tags).toContain('#action');
    expect(result!.tags).toContain('#completed');
    expect(result!.tags).toContain('#favorite');
    expect(result!.tags).toContain('#watch-later');
    expect(result!.tags).toContain('#wishlist');
  });

  it('deletes source item when deleteSource is true', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'watch-later');
    const db = getDatabase();

    copySeriesToSeriesTracker(db, 'user', 'user', 'tt-1', 'watch-later', true);

    const source = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'watch-later');
    expect(source).toBeUndefined();
  });

  it('returns null when source item is missing', () => {
    insertUser('user');
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-missing', 'library');

    expect(result).toBeNull();
  });

  it('returns null when source item is not a series', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'library', { contentType: 'movie' });
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'user', 'user', 'tt-1', 'library');

    expect(result).toBeNull();
  });

  it('copies from a readable shared library to requester series tracker', () => {
    insertUser('owner');
    insertUser('viewer');
    insertShare('owner', 'viewer', true);
    insertItem('owner', 'tt-1', ['#series']);
    const db = getDatabase();

    const result = copySeriesToSeriesTracker(db, 'viewer', 'owner', 'tt-1', 'library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'series-tracker' }));
    const viewerTracker = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('viewer', 'tt-1', 'series-tracker');
    expect(viewerTracker).toBeTruthy();
  });

  it('markAllSeriesAsWatched copies unwatched library series to tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-2', ['#movie'], 'library', { contentType: 'movie' });
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'series-tracker' }));
  });

  it('markAllSeriesAsWatched skips items already in tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series']);
    insertItem('user', 'tt-1', ['#series'], 'series-tracker');
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'user');

    expect(result).toHaveLength(0);
  });

  it('markAllSeriesAsWatched skips items already in tracker by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'series-tracker', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'user');

    expect(result).toHaveLength(0);
  });

  it('markAllSeriesAsWatched copies from readable shared library', () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('owner', 'tt-shared', ['#series']);
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'owner');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ IMDbId: 'tt-shared', listType: 'series-tracker' }));
  });

  it('markAllSeriesAsWatched copies provider-only library series', () => {
    insertUser('user');
    insertItem('user', null, ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      contentHash: 'provider-series-library',
    });
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ IMDbId: undefined, externalProvider: 'omdb', externalItemId: 'series-1' })
    );
    expect(
      db
        .prepare(
          'SELECT imdb_id, list_type FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
        )
        .get('user', 'omdb', 'series-1', 'series-tracker')
    ).toEqual({ imdb_id: null, list_type: 'series-tracker' });
  });

  it('markAllSeriesAsWatched returns empty array when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const result = markAllSeriesAsWatched(db, 'user', 'user');

    expect(result).toEqual([]);
  });

  it('findSeriesTrackerItemsForLibrarySeries returns tracker items with corresponding library series', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library');
    insertItem('user', 'tt-1', ['#series'], 'series-tracker');
    insertItem('user', 'tt-2', ['#series'], 'series-tracker');
    const db = getDatabase();

    const result = findSeriesTrackerItemsForLibrarySeries(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0].IMDbId).toBe('tt-1');
  });

  it('findSeriesTrackerItemsForLibrarySeries matches corresponding library series by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#series'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'series-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#series'], 'series-tracker', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = findSeriesTrackerItemsForLibrarySeries(db, 'user', 'user');

    expect(result).toHaveLength(1);
    expect(result[0].IMDbId).toBe('tt-tracker');
  });

  it('findOwnSeriesTrackerItems returns only own tracker items', () => {
    insertUser('user');
    insertUser('other');
    insertItem('user', 'tt-1', ['#series'], 'series-tracker');
    insertItem('other', 'tt-2', ['#series'], 'series-tracker');
    const db = getDatabase();

    const result = findOwnSeriesTrackerItems(db, 'user');

    expect(result).toHaveLength(1);
    expect(result[0].IMDbId).toBe('tt-1');
  });

  it('deleteAllSeriesTrackerItems removes all current user tracker items', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'series-tracker');
    insertItem('user', 'tt-2', ['#series'], 'series-tracker');
    insertItem('user', 'tt-3', ['#series'], 'library');
    const db = getDatabase();
    const insertIdentity = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, ?, ?, ?)`
    );
    insertIdentity.run('user', 'imdb:tt-1', 'imdb', 'tt-1', 'provider');
    insertIdentity.run('user', 'imdb:tt-2', 'imdb', 'tt-2', 'provider');
    insertIdentity.run('user', 'imdb:tt-3', 'imdb', 'tt-3', 'provider');

    const changedCount = deleteAllSeriesTrackerItems(db, 'user');

    expect(changedCount).toBe(2);
    const rows = db
      .prepare('SELECT imdb_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .all('user', 'series-tracker') as { imdb_id: string }[];
    expect(rows).toEqual([]);
    expect(
      db
        .prepare(
          'SELECT canonical_item_id FROM external_item_identities WHERE username_hash = ? ORDER BY canonical_item_id'
        )
        .all('user')
    ).toEqual([{ canonical_item_id: 'imdb:tt-3' }]);
  });
});
