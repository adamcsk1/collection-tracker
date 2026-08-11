import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import { insertLibraryShare } from '../../../../test/mocks/share-mock';
import {
  copyLibraryMovieToCompleted,
  copyMovieToCompleted,
  deleteAllCompletedItems,
  deleteCompletedItem,
  deleteCompletedItemByExternalId,
  markAllMoviesAsUncompleted,
  markAllMoviesAsCompleted,
} from './tracking-movie-repository';

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
      overrides.contentType ?? 'movie'
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
    db.prepare('INSERT INTO collection_item_tracker_state (item_id, completed_at) VALUES (?, CURRENT_TIMESTAMP)').run(
      itemId
    );
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  return itemId;
};

describe('tracking-movie-repository', () => {
  it('copies an own library movie to tracking', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#action']);
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-1');

    expect(result).toEqual(
      expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'tracking',
        contentType: 'movie',
        tags: ['#action', '#movie'],
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
    expect(trackerRow?.completed_at).toEqual(expect.any(String));
  });

  it('returns existing tracker item when already present (idempotent)', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'tracking');
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-1');

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
    insertItem('user', 'tt-library', ['#movie'], 'library', { externalItemId: 'provider-movie-1' });
    insertItem('user', 'tt-tracker', ['#movie'], 'tracking', { externalItemId: 'provider-movie-1' });
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-library');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-tracker', listType: 'tracking' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'provider-movie-1', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('returns existing tracker item by canonical identity when providers differ', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#movie'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#movie'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-library');

    expect(result).toEqual(expect.objectContaining({ canonicalItemId: 'imdb:tt-same', listType: 'tracking' }));
    const count = db
      .prepare('SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .get('user', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('preserves former system tags as custom tags and keeps the movie content type', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#completed', '#favorite', '#watchlist', '#wishlist', '#action']);
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-1');

    expect(result).toBeTruthy();
    expect(result!.contentType).toBe('movie');
    expect(result!.tags).toContain('#action');
    expect(result!.tags).toContain('#completed');
    expect(result!.tags).toContain('#favorite');
    expect(result!.tags).toContain('#watchlist');
    expect(result!.tags).toContain('#wishlist');
  });

  it('deletes source item when deleteSource is true', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'up-next');
    const db = getDatabase();

    copyMovieToCompleted(db, 'user', 'user', 'tt-1', 'up-next', true);

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

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-missing');

    expect(result).toBeNull();
  });

  it('returns null when source item is not a movie', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library', { contentType: 'series' });
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'user', 'user', 'tt-1');

    expect(result).toBeNull();
  });

  it('copies from a readable shared library to requester tracking', () => {
    insertUser('owner');
    insertUser('viewer');
    insertLibraryShare(getDatabase(), 'owner', 'viewer', { canRead: true });
    insertItem('owner', 'tt-1', ['#movie']);
    const db = getDatabase();

    const result = copyLibraryMovieToCompleted(db, 'viewer', 'owner', 'tt-1');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'tracking' }));
    const viewerTracker = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('viewer', 'omdb', 'tt-1', 'tracking');
    expect(viewerTracker).toBeTruthy();
  });

  it('deleteCompletedItem clears completion then prunes tracking item', () => {
    insertUser('user');
    const trackerItemId = insertItem('user', 'tt-1', ['#movie'], 'tracking');
    const db = getDatabase();

    const result = deleteCompletedItem(db, 'user', 'tt-1');

    expect(result).toBe(true);
    const row = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'tracking');
    expect(row).toBeUndefined();
    expect(
      db.prepare('SELECT 1 FROM collection_item_tracker_state WHERE item_id = ?').get(trackerItemId)
    ).toBeUndefined();
  });

  it('deleteCompletedItemByExternalId leaves book tracking untouched', () => {
    insertUser('user');
    const trackerItemId = insertItem('user', null, [], 'tracking', {
      contentType: 'book',
      externalProvider: 'openlibrary',
      externalItemId: '9780306406157',
      canonicalItemId: 'isbn:9780306406157',
      contentHash: 'book-tracking',
    });
    const db = getDatabase();
    db.prepare(
      'UPDATE collection_item_tracker_state SET progress_current = ?, progress_total = ? WHERE item_id = ?'
    ).run(40, 200, trackerItemId);

    const result = deleteCompletedItemByExternalId(db, 'user', 'openlibrary', '9780306406157');

    expect(result).toBe(false);
    expect(
      db
        .prepare(
          `SELECT tracker_state.completed_at, tracker_state.progress_current, tracker_state.progress_total
           FROM collection_items
           INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
           WHERE collection_items.username_hash = ? AND collection_items.external_provider = ?
             AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
        )
        .get('user', 'openlibrary', '9780306406157', 'tracking')
    ).toEqual({ completed_at: expect.any(String), progress_current: 40, progress_total: 200 });
  });

  it('deleteCompletedItem returns false for missing item', () => {
    insertUser('user');
    const db = getDatabase();

    const result = deleteCompletedItem(db, 'user', 'tt-missing');

    expect(result).toBe(false);
  });

  it('deleteAllCompletedItems removes all current user tracker items', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'tracking');
    insertItem('user', 'tt-2', ['#movie'], 'tracking');
    insertItem('user', 'tt-3', ['#movie'], 'library');
    const db = getDatabase();

    const changedCount = deleteAllCompletedItems(db, 'user');

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

  it('markAllMoviesAsCompleted copies uncompleted library movies to tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-2', ['#series'], 'library', { contentType: 'series' });
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'user');

    expect(changedCount).toBe(1);
    const tracker = db
      .prepare(
        `SELECT collection_items.list_type, tracker_state.completed_at
         FROM collection_items
         INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
         WHERE collection_items.username_hash = ? AND collection_items.external_provider = ?
           AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
      )
      .get('user', 'omdb', 'tt-1', 'tracking') as { list_type: string; completed_at: string | null } | undefined;
    expect(tracker?.list_type).toBe('tracking');
    expect(tracker?.completed_at).toEqual(expect.any(String));
  });

  it('markAllMoviesAsCompleted skips items already in tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsCompleted skips items already in tracker by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#movie'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#movie'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsCompleted copies from readable shared library', () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertItem('owner', 'tt-shared', ['#movie']);
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'owner');

    expect(changedCount).toBe(1);
    const tracker = db
      .prepare('SELECT username_hash, external_item_id, list_type FROM collection_items WHERE list_type = ?')
      .all('tracking') as { username_hash: string; external_item_id: string; list_type: string }[];
    expect(tracker).toEqual([{ username_hash: 'user', external_item_id: 'tt-shared', list_type: 'tracking' }]);
  });

  it('markAllMoviesAsCompleted copies provider-only library movies', () => {
    insertUser('user');
    insertItem('user', null, ['#movie'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      contentHash: 'provider-movie-library',
    });
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'user');

    expect(changedCount).toBe(1);
    expect(
      db
        .prepare(
          'SELECT external_item_id, list_type FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
        )
        .get('user', 'omdb', 'movie-1', 'tracking')
    ).toEqual({ external_item_id: 'movie-1', list_type: 'tracking' });
  });

  it('markAllMoviesAsCompleted returns 0 when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const changedCount = markAllMoviesAsCompleted(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsCompleted limits candidates to explicit source item IDs', () => {
    insertUser('user');
    const firstItemId = insertItem('user', 'tt-1', []);
    insertItem('user', 'tt-2', []);
    const thirdItemId = insertItem('user', 'tt-3', []);
    const db = getDatabase();

    expect(markAllMoviesAsCompleted(db, 'user', 'user', [])).toBe(0);
    expect(markAllMoviesAsCompleted(db, 'user', 'user', [firstItemId, thirdItemId])).toBe(2);

    expect(
      db
        .prepare("SELECT external_item_id FROM collection_items WHERE list_type = 'tracking' ORDER BY external_item_id")
        .all()
    ).toEqual([{ external_item_id: 'tt-1' }, { external_item_id: 'tt-3' }]);
  });

  it('markAllMoviesAsUncompleted deletes tracker copies matching own library', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'user');

    expect(changedCount).toBe(1);
    const row = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'tracking');
    expect(row).toBeUndefined();
  });

  it('markAllMoviesAsUncompleted leaves tracker-only items untouched', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'user');

    expect(changedCount).toBe(0);
    const row = db
      .prepare(
        'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', 'omdb', 'tt-1', 'tracking');
    expect(row).toBeTruthy();
  });

  it('markAllMoviesAsUncompleted deletes tracker copies matching shared library only', () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertItem('owner', 'tt-shared', ['#movie']);
    insertItem('user', 'tt-shared', ['#movie'], 'tracking');
    insertItem('user', 'tt-own', ['#movie'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'owner');

    expect(changedCount).toBe(1);
    const rows = db
      .prepare(
        'SELECT external_item_id FROM collection_items WHERE username_hash = ? AND list_type = ? ORDER BY external_item_id'
      )
      .all('user', 'tracking') as { external_item_id: string }[];
    expect(rows).toEqual([{ external_item_id: 'tt-own' }]);
  });

  it('markAllMoviesAsUncompleted deletes provider-only tracker copies matching own library', () => {
    insertUser('user');
    insertItem('user', null, ['#movie'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      contentHash: 'provider-movie-library',
    });
    insertItem('user', null, ['#movie'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      contentHash: 'provider-watched',
    });
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'user');

    expect(changedCount).toBe(1);
    expect(
      db
        .prepare(
          'SELECT 1 FROM collection_items WHERE username_hash = ? AND external_provider = ? AND external_item_id = ? AND list_type = ?'
        )
        .get('user', 'omdb', 'movie-1', 'tracking')
    ).toBeUndefined();
  });

  it('markAllMoviesAsUncompleted deletes tracker copies matching own library by canonical identity', () => {
    insertUser('user');
    insertItem('user', 'tt-library', ['#movie'], 'library', {
      externalProvider: 'omdb',
      externalItemId: 'movie-1',
      canonicalItemId: 'imdb:tt-same',
    });
    insertItem('user', 'tt-tracker', ['#movie'], 'tracking', {
      externalProvider: 'omdb',
      externalItemId: 'tt-same',
      canonicalItemId: 'imdb:tt-same',
    });
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'user');

    expect(changedCount).toBe(1);
    expect(
      db.prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND list_type = ?').get('user', 'tracking')
    ).toBeUndefined();
  });

  it('markAllMoviesAsUncompleted returns 0 when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUncompleted(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsUncompleted limits completed tracking rows to explicit source item IDs', () => {
    insertUser('user');
    const firstItemId = insertItem('user', 'tt-1', []);
    insertItem('user', 'tt-2', []);
    const thirdItemId = insertItem('user', 'tt-3', []);
    insertItem('user', 'tt-1', [], 'tracking');
    insertItem('user', 'tt-2', [], 'tracking');
    insertItem('user', 'tt-3', [], 'tracking');
    const db = getDatabase();

    expect(markAllMoviesAsUncompleted(db, 'user', 'user', [])).toBe(0);
    expect(markAllMoviesAsUncompleted(db, 'user', 'user', [firstItemId, thirdItemId])).toBe(2);

    expect(
      db
        .prepare("SELECT external_item_id FROM collection_items WHERE list_type = 'tracking' ORDER BY external_item_id")
        .all()
    ).toEqual([{ external_item_id: 'tt-2' }]);
  });
});
