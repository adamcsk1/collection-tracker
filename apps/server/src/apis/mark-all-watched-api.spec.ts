import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = () => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run('user', 'token');
};

const insertItem = (imdbId: string, tags: string[] = []) => {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run('user', imdbId, 'Title', 'title', '', '', '', '', 'hash');
  const itemId = Number(result.lastInsertRowid);
  for (const tag of tags) {
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, tag);
  }
};

describe('mark-all-watched-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns changedCount when unwatched items exist', async () => {
    insertUser();
    insertItem('tt-1', ['#movie']);
    insertItem('tt-2', ['#movie', '#watched']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 1 });

    const db = getDatabase();
    const tags = db
      .prepare(
        `SELECT tag FROM collection_item_tags
         INNER JOIN collection_items ON collection_items.id = collection_item_tags.item_id
         WHERE collection_items.imdb_id = ?`
      )
      .all('tt-1') as Array<{ tag: string }>;
    expect(tags.map((t) => t.tag)).toContain('#watched');
  });

  it('returns 0 when all items are already watched', async () => {
    insertUser();
    insertItem('tt-1', ['#movie', '#watched']);

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });

  it('returns 0 for an empty collection', async () => {
    insertUser();

    const response = mockResponse();
    const request: any = { usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./mark-all-watched-api');
    register(app);

    await handlerPromise();
    expect(response.send).toHaveBeenCalledWith({ changedCount: 0 });
  });
});
