import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertLibraryShare } from '../../test/mocks/share-mock';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertBookItem = (bookId: string, tags: string[] = [], listType = 'books', usernameHash = 'user') => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, title, title_lower, year, description, image, content_hash, content_type)
       VALUES (?, 'openlibrary', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'book')`
    )
    .run(
      usernameHash,
      bookId,
      `openlibrary:${bookId}`,
      listType,
      'Title',
      'title',
      '',
      '',
      '',
      `${usernameHash}-${listType}-${bookId}`
    );
  const itemId = Number(result.lastInsertRowid);
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

describe('mark-all-books-uncompleted-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('clears completed timestamp for tracking copies of own library books', async () => {
    insertUser();
    insertBookItem('9780132350884', ['#book'], 'books');
    const trackerId = insertBookItem('9780132350884', ['#book'], 'tracking');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });

    const db = getDatabase();
    const state = db
      .prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?')
      .get(trackerId) as { completed_at: string | null };
    expect(state.completed_at).toBeNull();
  });

  it('returns 0 when no books are completed', async () => {
    insertUser();
    insertBookItem('9780132350884', ['#book']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('returns 0 for an empty collection', async () => {
    insertUser();

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('rejects shared ownerShareCode without books read grant', async () => {
    insertUser('user');
    insertUser('owner');
    insertLibraryShare(getDatabase(), 'owner', 'user', { canRead: true });
    insertBookItem('9780201633610', ['#book'], 'books', 'owner');
    const sharedTrackerId = insertBookItem('9780201633610', ['#book'], 'tracking', 'user');
    insertBookItem('9780134685991', ['#book'], 'books', 'user');
    const ownTrackerId = insertBookItem('9780134685991', ['#book'], 'tracking', 'user');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-uncompleted-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();

    const sharedState = getDatabase()
      .prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?')
      .get(sharedTrackerId) as { completed_at: string | null };
    expect(sharedState.completed_at).not.toBeNull();

    const ownState = getDatabase()
      .prepare('SELECT completed_at FROM collection_item_tracker_state WHERE item_id = ?')
      .get(ownTrackerId) as { completed_at: string | null };
    expect(ownState.completed_at).not.toBeNull();
  });
});
