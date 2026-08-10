import { describe, expect, it } from 'vitest';
import { getDatabase } from '../database';
import { insertLibraryShare } from '../../../../test/mocks/share-mock';
import {
  copyBookToCompletedByExternalId,
  deleteCompletedBookByExternalId,
  markAllBooksAsCompleted,
  markAllBooksAsUncompleted,
} from './tracking-book-repository';

const insertUser = (usernameHash: string) => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertBookItem = (
  usernameHash: string,
  bookId: string,
  tags: string[] = ['#book'],
  listType = 'books',
  overrides: Partial<{
    title: string;
    externalProvider: string;
    externalItemId: string;
    canonicalItemId: string;
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
      overrides.externalProvider ?? 'openlibrary',
      overrides.externalItemId ?? bookId,
      overrides.canonicalItemId ??
        `${overrides.externalProvider ?? 'openlibrary'}:${overrides.externalItemId ?? bookId}`,
      listType,
      overrides.title ?? 'Book Title',
      overrides.title?.toLowerCase() ?? 'book title',
      '2023',
      'Author Name',
      '',
      '',
      `${usernameHash}-${listType}-${bookId}`,
      overrides.contentType ?? 'book'
    );
  const itemId = Number(result.lastInsertRowid);
  if (listType === 'tracking') {
    const completed = overrides.completed !== false;
    db.prepare(
      `INSERT INTO collection_item_tracker_state (item_id, completed_at, progress_current, progress_total)
       VALUES (?, ${completed ? 'CURRENT_TIMESTAMP' : 'NULL'}, ?, ?)`
    ).run(itemId, overrides.progressCurrent ?? null, overrides.progressTotal ?? null);
  }
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
  return itemId;
};

describe('tracking-book-repository', () => {
  it('markAllBooksAsCompleted copies uncompleted library books to tracker', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book']);
    const db = getDatabase();

    const changedCount = markAllBooksAsCompleted(db, 'user');

    expect(changedCount).toBe(1);
    const tracker = db
      .prepare(
        `SELECT collection_items.list_type, tracker_state.completed_at
         FROM collection_items
         INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
         WHERE collection_items.username_hash = ? AND collection_items.external_provider = ?
           AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
      )
      .get('user', 'openlibrary', '9780132350884', 'tracking') as
      { list_type: string; completed_at: string | null } | undefined;
    expect(tracker?.list_type).toBe('tracking');
    expect(tracker?.completed_at).toEqual(expect.any(String));
  });

  it('markAllBooksAsCompleted skips books already completed in tracker', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    insertBookItem('user', '9780132350884', ['#book'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllBooksAsCompleted(db, 'user');

    expect(changedCount).toBe(0);
  });

  it('markAllBooksAsCompleted completes existing uncompleted tracker rows', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    const trackingId = insertBookItem('user', '9780132350884', ['#book'], 'tracking', {
      completed: false,
      progressCurrent: 40,
      progressTotal: 200,
    });
    const db = getDatabase();

    const changedCount = markAllBooksAsCompleted(db, 'user');

    expect(changedCount).toBe(1);
    const state = db
      .prepare(
        'SELECT completed_at, progress_current, progress_total FROM collection_item_tracker_state WHERE item_id = ?'
      )
      .get(trackingId) as {
      completed_at: string | null;
      progress_current: number | null;
      progress_total: number | null;
    };
    expect(state.completed_at).toEqual(expect.any(String));
    expect(state.progress_current).toBe(40);
    expect(state.progress_total).toBe(200);
    const count = db
      .prepare(
        'SELECT COUNT(*) as count FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?'
      )
      .get('user', '9780132350884', 'tracking') as { count: number };
    expect(count.count).toBe(1);
  });

  it('markAllBooksAsCompleted only uses the requester books list', () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertBookItem('user', '9780134685991', ['#book'], 'books');
    insertBookItem('owner', '9780201633610', ['#book'], 'books');
    const db = getDatabase();

    const changedCount = markAllBooksAsCompleted(db, 'user');

    expect(changedCount).toBe(1);
    const rows = db
      .prepare(
        'SELECT username_hash, external_item_id, list_type FROM collection_items WHERE list_type = ? ORDER BY username_hash'
      )
      .all('tracking');
    expect(rows).toEqual([{ username_hash: 'user', external_item_id: '9780134685991', list_type: 'tracking' }]);
  });

  it('markAllBooksAsUncompleted clears completed timestamp and keeps tracking row and progress', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    const trackingId = insertBookItem('user', '9780132350884', ['#book'], 'tracking', {
      progressCurrent: 40,
      progressTotal: 200,
    });
    const db = getDatabase();

    const changedCount = markAllBooksAsUncompleted(db, 'user');

    expect(changedCount).toBe(1);
    const state = db
      .prepare(
        'SELECT completed_at, progress_current, progress_total FROM collection_item_tracker_state WHERE item_id = ?'
      )
      .get(trackingId) as {
      completed_at: string | null;
      progress_current: number | null;
      progress_total: number | null;
    };
    expect(state.completed_at).toBeNull();
    expect(state.progress_current).toBe(40);
    expect(state.progress_total).toBe(200);
    const tracker = db
      .prepare('SELECT 1 FROM collection_items WHERE id = ? AND list_type = ?')
      .get(trackingId, 'tracking');
    expect(tracker).toBeDefined();
  });

  it('markAllBooksAsUncompleted only clears tracking copies of own books list items', () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertBookItem('owner', '9780201633610', ['#book'], 'books');
    const sharedTrackerId = insertBookItem('user', '9780201633610', ['#book'], 'tracking');
    insertBookItem('user', '9780134685991', ['#book'], 'books');
    const ownTrackerId = insertBookItem('user', '9780134685991', ['#book'], 'tracking');
    const db = getDatabase();

    const changedCount = markAllBooksAsUncompleted(db, 'user');

    expect(changedCount).toBe(1);
    const sharedState = db
      .prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?')
      .get(sharedTrackerId) as { completed_at: string | null };
    expect(sharedState.completed_at).not.toBeNull();
    const ownState = db
      .prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?')
      .get(ownTrackerId) as { completed_at: string | null };
    expect(ownState.completed_at).toBeNull();
  });

  it('copyBookToCompletedByExternalId copies a books-list item into tracking as completed', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    const db = getDatabase();

    const result = copyBookToCompletedByExternalId(db, 'user', 'user', 'openlibrary', '9780132350884', 'books', false);

    expect(result).toEqual(
      expect.objectContaining({
        externalItemId: '9780132350884',
        listType: 'tracking',
        contentType: 'book',
      })
    );
    const tracker = db
      .prepare(
        `SELECT tracker_state.completed_at
         FROM collection_items
         INNER JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = collection_items.id
         WHERE collection_items.username_hash = ? AND collection_items.external_item_id = ? AND collection_items.list_type = ?`
      )
      .get('user', '9780132350884', 'tracking') as { completed_at: string | null } | undefined;
    expect(tracker?.completed_at).toEqual(expect.any(String));
  });

  it('deleteCompletedBookByExternalId clears completion and keeps progress', () => {
    insertUser('user');
    const trackingId = insertBookItem('user', '9780306406157', ['#book'], 'tracking', {
      progressCurrent: 40,
      progressTotal: 200,
    });
    const db = getDatabase();

    const result = deleteCompletedBookByExternalId(db, 'user', 'openlibrary', '9780306406157');

    expect(result).toBe(true);
    expect(
      db
        .prepare(
          'SELECT completed_at, progress_current, progress_total FROM collection_item_tracker_state WHERE item_id = ?'
        )
        .get(trackingId)
    ).toEqual({ completed_at: null, progress_current: 40, progress_total: 200 });
  });

  it('returns null when source book does not exist', () => {
    insertUser('user');

    expect(
      copyBookToCompletedByExternalId(getDatabase(), 'user', 'user', 'openlibrary', '9780306406157', 'books')
    ).toBeNull();
  });

  it('returns false when completed tracker book does not exist', () => {
    insertUser('user');

    expect(deleteCompletedBookByExternalId(getDatabase(), 'user', 'openlibrary', 'missing')).toBe(false);
  });

  it('rejects non-book source and tracking rows', () => {
    insertUser('user');
    insertBookItem('user', '9780306406157', [], 'library', { contentType: 'movie' });
    insertBookItem('user', '9780140328721', [], 'tracking', { contentType: 'movie' });
    const db = getDatabase();

    expect(copyBookToCompletedByExternalId(db, 'user', 'user', 'openlibrary', '9780306406157', 'library')).toBeNull();
    expect(deleteCompletedBookByExternalId(db, 'user', 'openlibrary', '9780140328721')).toBe(false);
  });

  it('deletes source after creating completed tracker copy', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    const db = getDatabase();

    const result = copyBookToCompletedByExternalId(db, 'user', 'user', 'openlibrary', '9780132350884', 'books', true);

    expect(result?.listType).toBe('tracking');
    expect(
      db
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', '9780132350884', 'books')
    ).toBeUndefined();
  });

  it('deletes source after completing an existing tracker copy', () => {
    insertUser('user');
    insertBookItem('user', '9780132350884', ['#book'], 'books');
    insertBookItem('user', '9780132350884', ['#book'], 'tracking', { completed: false });
    const db = getDatabase();

    const result = copyBookToCompletedByExternalId(db, 'user', 'user', 'openlibrary', '9780132350884', 'books', true);

    expect(result?.watchedAt).not.toBeNull();
    expect(
      db
        .prepare('SELECT 1 FROM collection_items WHERE username_hash = ? AND external_item_id = ? AND list_type = ?')
        .get('user', '9780132350884', 'books')
    ).toBeUndefined();
  });

  it('finds source by external identity when canonical identity is absent', () => {
    insertUser('user');
    const sourceId = insertBookItem('user', '9780132350884', ['#book'], 'books');
    const db = getDatabase();
    db.prepare('UPDATE collection_items SET canonical_item_id = NULL WHERE id = ?').run(sourceId);

    const result = copyBookToCompletedByExternalId(db, 'user', 'user', 'openlibrary', '9780132350884', 'books');

    expect(result?.listType).toBe('tracking');
  });

  it('marks and clears books from an explicit shared source owner', () => {
    insertUser('user');
    insertUser('owner');
    insertBookItem('owner', '9780132350884', ['#book'], 'books');
    const db = getDatabase();

    expect(markAllBooksAsCompleted(db, 'user', 'owner')).toBe(1);
    expect(markAllBooksAsUncompleted(db, 'user', 'owner')).toBe(1);
  });
});
