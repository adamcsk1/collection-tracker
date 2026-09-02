import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import {
  copyAlbumToCompletedByExternalId,
  copyAlbumToTrackingByExternalId,
  markAllMusicAsCompleted,
  markAllMusicAsUncompleted,
} from './tracking-music-repository';

const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertAlbumItem = (
  usernameHash: string,
  albumId: string,
  listType = 'music',
  overrides: Partial<{
    contentType: string;
    completed: boolean;
    progressCurrent: number | null;
    progressTotal: number | null;
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
      'musicbrainz',
      albumId,
      `musicbrainz:${albumId}`,
      listType,
      'Album Title',
      'album title',
      '1973',
      'Artist Name',
      '',
      '',
      `${usernameHash}-${listType}-${albumId}`,
      overrides.contentType ?? 'album'
    );
  const itemId = Number(result.lastInsertRowid);
  if (listType === 'tracking') {
    const completed = overrides.completed !== false;
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
       VALUES (?, ${completed ? 'CURRENT_TIMESTAMP' : 'NULL'}, ?, ?)`
    ).run(itemId, overrides.progressCurrent ?? null, overrides.progressTotal ?? null);
  }
  return itemId;
};

describe('tracking-music-repository', () => {
  it('markAllMusicAsCompleted copies uncompleted music list albums to tracker', () => {
    insertUser('user');
    insertAlbumItem('user', mbid);

    const changedCount = markAllMusicAsCompleted(getDatabase(), 'user');

    expect(changedCount).toBe(1);
    expect(
      getDatabase()
        .prepare(`SELECT content_type FROM collection_items WHERE username_hash = ? AND list_type = 'tracking'`)
        .get('user')
    ).toEqual({ content_type: 'album' });
  });

  it('markAllMusicAsUncompleted clears completed timestamp and keeps tracking row and progress', () => {
    insertUser('user');
    insertAlbumItem('user', mbid, 'music');
    const trackingId = insertAlbumItem('user', mbid, 'tracking', {
      progressCurrent: 4,
      progressTotal: 10,
    });

    const changedCount = markAllMusicAsUncompleted(getDatabase(), 'user');

    expect(changedCount).toBe(1);
    expect(
      getDatabase()
        .prepare(
          'SELECT completed_at, progress_current, progress_total FROM collection_item_tracker_state WHERE item_id = ?'
        )
        .get(trackingId)
    ).toEqual({ completed_at: null, progress_current: 4, progress_total: 10 });
  });

  it('copyAlbumToCompletedByExternalId copies a music-list item into tracking as completed', () => {
    insertUser('user');
    insertAlbumItem('user', mbid, 'music');

    const result = copyAlbumToCompletedByExternalId(getDatabase(), 'user', 'user', 'musicbrainz', mbid, 'music', false);

    expect(result).toEqual(expect.objectContaining({ contentType: 'album', listType: 'tracking' }));
  });

  it('copies an own music-list album into tracking as uncompleted', () => {
    insertUser('user');
    insertAlbumItem('user', mbid, 'music');

    const result = copyAlbumToTrackingByExternalId(getDatabase(), 'user', 'user', 'musicbrainz', mbid, 'music');

    expect(result).toEqual(expect.objectContaining({ contentType: 'album', listType: 'tracking', watched: false }));
    expect(
      getDatabase()
        .prepare(
          `SELECT tracker_state.completed_at
           FROM collection_item_tracker_state tracker_state
           INNER JOIN collection_items item ON item.id = tracker_state.item_id
           WHERE item.username_hash = ? AND item.external_item_id = ? AND item.list_type = 'tracking'`
        )
        .get('user', mbid)
    ).toEqual({ completed_at: null });
  });

  it('copies a shared music-list album into requester tracking and keeps source', () => {
    insertUser('user');
    insertUser('owner');
    insertAlbumItem('owner', mbid, 'music');

    const result = copyAlbumToTrackingByExternalId(getDatabase(), 'user', 'owner', 'musicbrainz', mbid, 'music');

    expect(result).toEqual(expect.objectContaining({ contentType: 'album', listType: 'tracking', watched: false }));
    expect(
      getDatabase()
        .prepare(
          'SELECT username_hash, list_type FROM collection_items WHERE external_item_id = ? ORDER BY username_hash'
        )
        .all(mbid)
    ).toEqual([
      { username_hash: 'owner', list_type: 'music' },
      { username_hash: 'user', list_type: 'tracking' },
    ]);
  });

  it('moves an up-next album into tracking as uncompleted', () => {
    insertUser('user');
    insertAlbumItem('user', mbid, 'up-next');

    const result = copyAlbumToTrackingByExternalId(getDatabase(), 'user', 'user', 'musicbrainz', mbid, 'up-next', true);

    expect(result).toEqual(expect.objectContaining({ contentType: 'album', listType: 'tracking', watched: false }));
    expect(
      getDatabase()
        .prepare('SELECT list_type FROM collection_items WHERE username_hash = ? AND external_item_id = ?')
        .all('user', mbid)
    ).toEqual([{ list_type: 'tracking' }]);
  });

  it('returns null when source album does not exist', () => {
    insertUser('user');
    expect(copyAlbumToCompletedByExternalId(getDatabase(), 'user', 'user', 'musicbrainz', mbid, 'music')).toBeNull();
  });
});
