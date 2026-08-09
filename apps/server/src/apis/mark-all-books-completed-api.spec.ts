import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash = 'user') => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertBookItem = (bookId: string, tags: string[] = ['#book'], listType = 'books', usernameHash = 'user') => {
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
};

const insertShare = (ownerHash: string, sharedWithHash: string, canRead: boolean) => {
  getDatabase()
    .prepare(
      `INSERT INTO user_shares (owner_username_hash, shared_with_username_hash, can_read, can_create, can_update, can_delete)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(ownerHash, sharedWithHash, canRead ? 1 : 0, 0, 0, 0);
};

describe('mark-all-books-completed-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('copies uncompleted library books to tracking', async () => {
    insertUser();
    insertBookItem('9780132350884', ['#book']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });

    const db = getDatabase();
    const trackerItem = db
      .prepare(
        `SELECT list_type FROM collection_items
         WHERE username_hash = ? AND external_item_id = ? AND list_type = ?`
      )
      .get('user', '9780132350884', 'tracking') as { list_type: string } | undefined;
    expect(trackerItem?.list_type).toBe('tracking');
  });

  it('returns 0 when all books are already completed', async () => {
    insertUser();
    insertBookItem('9780132350884', ['#book'], 'books');
    insertBookItem('9780132350884', ['#book'], 'tracking');

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('returns 0 for an empty collection', async () => {
    insertUser();

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-completed-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('rejects shared-library ownerShareCode because books lists are private', async () => {
    insertUser('user');
    insertUser('owner');
    insertShare('owner', 'user', true);
    insertBookItem('9780134685991', ['#book'], 'books', 'user');
    insertBookItem('9780201633610', ['#book'], 'books', 'owner');

    const response = mockResponse();
    const request: any = { usernameHash: 'user', query: { ownerShareCode: getUserShareCode('owner') } };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-books-completed-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(403);
    expect(response.send).toHaveBeenCalledWith();

    const rows = getDatabase()
      .prepare('SELECT username_hash, external_item_id, list_type FROM collection_items WHERE list_type = ?')
      .all('tracking');
    expect(rows).toEqual([]);
  });
});
