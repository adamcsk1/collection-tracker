import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  copyLibraryMovieToMovieTracker,
  copyMovieToMovieTracker,
  deleteAllMovieTrackerItems,
  deleteMovieTrackerItem,
  markAllMoviesAsUnwatched,
  markAllMoviesAsWatched,
} from './movie-tracker-repository';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (
  usernameHash: string,
  imdbId: string,
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
  }> = {}
) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, list_type, title, title_lower, year, rate, plot, image, content_hash, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usernameHash,
      imdbId,
      listType,
      overrides.title ?? 'Title',
      overrides.title?.toLowerCase() ?? 'title',
      overrides.year ?? '',
      overrides.rate ?? '',
      overrides.plot ?? '',
      overrides.image ?? '',
      overrides.contentHash ?? `${usernameHash}-${listType}-${imdbId}`,
      overrides.contentType ?? 'movie'
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

describe('movie-tracker-repository', () => {
  it('copies an own library movie to the movie tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#action']);
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'user', 'user', 'tt-1');

    expect(result).toEqual(
      expect.objectContaining({
        IMDbId: 'tt-1',
        listType: 'movie-tracker',
        contentType: 'movie',
        tags: ['#action', '#movie'],
      })
    );
    const trackerRow = db
      .prepare(
        'SELECT list_type, watched_at FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?'
      )
      .get('user', 'tt-1', 'movie-tracker') as { list_type: string; watched_at: string | null } | undefined;
    expect(trackerRow?.list_type).toBe('movie-tracker');
    expect(trackerRow?.watched_at).toEqual(expect.any(String));
  });

  it('returns existing tracker item when already present (idempotent)', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'user', 'user', 'tt-1');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker' }));
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?'
      )
      .get('user', 'tt-1', 'movie-tracker') as { count: number };
    expect(count.count).toBe(1);
  });

  it('preserves former system tags as custom tags and keeps the movie content type', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie', '#completed', '#favorite', '#watch-later', '#wishlist', '#action']);
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'user', 'user', 'tt-1');

    expect(result).toBeTruthy();
    expect(result!.contentType).toBe('movie');
    expect(result!.tags).toContain('#action');
    expect(result!.tags).toContain('#completed');
    expect(result!.tags).toContain('#favorite');
    expect(result!.tags).toContain('#watch-later');
    expect(result!.tags).toContain('#wishlist');
  });

  it('deletes source item when deleteSource is true', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'watch-later');
    const db = getDatabase();

    copyMovieToMovieTracker(db, 'user', 'user', 'tt-1', 'watch-later', true);

    const source = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'watch-later');
    expect(source).toBeUndefined();
  });

  it('returns null when source item is missing', () => {
    insertUser('user');
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'user', 'user', 'tt-missing');

    expect(result).toBeNull();
  });

  it('returns null when source item is not a movie', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#series'], 'library', { contentType: 'series' });
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'user', 'user', 'tt-1');

    expect(result).toBeNull();
  });

  it('copies from a readable shared library to requester movie tracker', () => {
    insertUser('owner');
    insertUser('viewer');
    insertShare('owner', 'viewer', true);
    insertItem('owner', 'tt-1', ['#movie']);
    const db = getDatabase();

    const result = copyLibraryMovieToMovieTracker(db, 'viewer', 'owner', 'tt-1');

    expect(result).toEqual(expect.objectContaining({ IMDbId: 'tt-1', listType: 'movie-tracker' }));
    const viewerTracker = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('viewer', 'tt-1', 'movie-tracker');
    expect(viewerTracker).toBeTruthy();
  });

  it('deleteMovieTrackerItem deletes existing item', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const result = deleteMovieTrackerItem(db, 'user', 'tt-1');

    expect(result).toBe(true);
    const row = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'movie-tracker');
    expect(row).toBeUndefined();
  });

  it('deleteMovieTrackerItem returns false for missing item', () => {
    insertUser('user');
    const db = getDatabase();

    const result = deleteMovieTrackerItem(db, 'user', 'tt-missing');

    expect(result).toBe(false);
  });

  it('deleteAllMovieTrackerItems removes all current user tracker items', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    insertItem('user', 'tt-2', ['#movie'], 'movie-tracker');
    insertItem('user', 'tt-3', ['#movie'], 'library');
    const db = getDatabase();

    const changedCount = deleteAllMovieTrackerItems(db, 'user');

    expect(changedCount).toBe(2);
    const rows = db
      .prepare('SELECT imdb_id FROM collection_items WHERE username_hash = ? AND list_type = ?')
      .all('user', 'movie-tracker') as { imdb_id: string }[];
    expect(rows).toEqual([]);
  });

  it('markAllMoviesAsWatched copies unwatched library movies to tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-2', ['#series'], 'library', { contentType: 'series' });
    const db = getDatabase();

    const changedCount = markAllMoviesAsWatched(db, 'user', 'user');

    expect(changedCount).toBe(1);
    const tracker = db
      .prepare(
        'SELECT list_type, watched_at FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?'
      )
      .get('user', 'tt-1', 'movie-tracker') as { list_type: string; watched_at: string | null } | undefined;
    expect(tracker?.list_type).toBe('movie-tracker');
    expect(tracker?.watched_at).toEqual(expect.any(String));
  });

  it('markAllMoviesAsWatched skips items already in tracker', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const changedCount = markAllMoviesAsWatched(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsWatched copies from readable shared library', () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('owner', 'tt-shared', ['#movie']);
    const db = getDatabase();

    const changedCount = markAllMoviesAsWatched(db, 'user', 'owner');

    expect(changedCount).toBe(1);
    const tracker = db
      .prepare('SELECT username_hash, imdb_id, list_type FROM collection_items WHERE list_type = ?')
      .all('movie-tracker') as { username_hash: string; imdb_id: string; list_type: string }[];
    expect(tracker).toEqual([{ username_hash: 'user', imdb_id: 'tt-shared', list_type: 'movie-tracker' }]);
  });

  it('markAllMoviesAsWatched returns 0 when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const changedCount = markAllMoviesAsWatched(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllMoviesAsUnwatched deletes tracker copies matching own library', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie']);
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUnwatched(db, 'user', 'user');

    expect(changedCount).toBe(1);
    const row = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'movie-tracker');
    expect(row).toBeUndefined();
  });

  it('markAllMoviesAsUnwatched leaves tracker-only items untouched', () => {
    insertUser('user');
    insertItem('user', 'tt-1', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUnwatched(db, 'user', 'user');

    expect(changedCount).toBe(0);
    const row = db
      .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND imdb_id = ? AND list_type = ?')
      .get('user', 'tt-1', 'movie-tracker');
    expect(row).toBeTruthy();
  });

  it('markAllMoviesAsUnwatched deletes tracker copies matching shared library only', () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertItem('owner', 'tt-shared', ['#movie']);
    insertItem('user', 'tt-shared', ['#movie'], 'movie-tracker');
    insertItem('user', 'tt-own', ['#movie'], 'movie-tracker');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUnwatched(db, 'user', 'owner');

    expect(changedCount).toBe(1);
    const rows = db
      .prepare('SELECT imdb_id FROM collection_items WHERE username_hash = ? AND list_type = ? ORDER BY imdb_id')
      .all('user', 'movie-tracker') as { imdb_id: string }[];
    expect(rows).toEqual([{ imdb_id: 'tt-own' }]);
  });

  it('markAllMoviesAsUnwatched returns 0 when no candidates exist', () => {
    insertUser('user');
    const db = getDatabase();

    const changedCount = markAllMoviesAsUnwatched(db, 'user', 'user');

    expect(changedCount).toBe(0);
  });
});
