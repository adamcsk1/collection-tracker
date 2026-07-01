import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { getDatabase } from '../core/database/database';
import { afterEach, describe, expect, it, vi } from 'vitest';

const insertUser = (usernameHash: string): void => {
  getDatabase().prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)').run(usernameHash, 'token');
};

const insertItem = (usernameHash: string, imdbId: string): number => {
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items (username_hash, imdb_id, title, title_lower, year, rate, plot, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, imdbId, `Title ${imdbId}`, `title ${imdbId}`, '2024', '7', 'Plot', 'image.jpg', 'old-hash');
  return Number(result.lastInsertRowid);
};

const insertTagConfig = (usernameHash: string, tag: string, color: string, weight: number): void => {
  getDatabase()
    .prepare(
      `INSERT INTO tag_configs
       (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(usernameHash, tag, color, 1, 0, 0, weight);
};

describe('rename-tag-management-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 400 when body is not an object', async () => {
    const response = mockResponse();
    const request: any = { body: [], usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);

    const { register } = await import('./rename-tag-management-api');
    register(app);

    await handlerPromise();
    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when tags are missing, empty, or unchanged', async () => {
    for (const body of [{ oldTag: '#old' }, { oldTag: '#old', newTag: '   ' }, { oldTag: '#old', newTag: '#old' }]) {
      const response = mockResponse();
      const request: any = { body, usernameHash: 'user' };
      const { app, handlerPromise } = buildApp(request, response);

      const { register } = await import('./rename-tag-management-api');
      register(app);

      await handlerPromise();
      expect(response.code).toHaveBeenCalledWith(400);
      vi.resetModules();
    }
  });

  it('renames collection item tags and tag management for the current user', async () => {
    const response = mockResponse();
    const request: any = { body: { oldTag: '  #old  ', newTag: '  #new  ' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    insertUser('user');
    const itemId = insertItem('user', 'tt-rename');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemId, '#old');
    insertTagConfig('user', '#old', '#111111', 4);

    const { register } = await import('./rename-tag-management-api');
    register(app);

    await handlerPromise();

    expect(db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ?').all(itemId)).toEqual([{ tag: '#new' }]);
    expect(db.prepare('SELECT tag, color, weight FROM tag_configs WHERE username_hash = ?').all('user')).toEqual([
      { tag: '#new', color: '#111111', weight: 4 },
    ]);
    expect(db.prepare('SELECT content_hash FROM collection_items WHERE id = ?').get(itemId)).not.toEqual({
      content_hash: 'old-hash',
    });
    expect(response.send).toHaveBeenCalledWith({
      renamedItemCount: 1,
      tagManagement: [
        {
          tag: '#new',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 4,
        },
      ],
    });
  });

  it('merges into existing tags and keeps the target tag management config', async () => {
    const response = mockResponse();
    const request: any = { body: { oldTag: '#old', newTag: '#new' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    insertUser('user');
    const itemWithOldTag = insertItem('user', 'tt-old');
    const itemWithBothTags = insertItem('user', 'tt-both');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemWithOldTag, '#old');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemWithBothTags, '#old');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(itemWithBothTags, '#new');
    insertTagConfig('user', '#old', '#111111', 4);
    insertTagConfig('user', '#new', '#222222', 9);

    const { register } = await import('./rename-tag-management-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({
      renamedItemCount: 2,
      tagManagement: [
        {
          tag: '#new',
          color: '#222222',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 9,
        },
      ],
    });
    expect(db.prepare('SELECT item_id, tag FROM collection_item_tags ORDER BY item_id, tag').all()).toEqual([
      { item_id: itemWithOldTag, tag: '#new' },
      { item_id: itemWithBothTags, tag: '#new' },
    ]);
    expect(db.prepare('SELECT tag, color, weight FROM tag_configs WHERE username_hash = ?').all('user')).toEqual([
      { tag: '#new', color: '#222222', weight: 9 },
    ]);
  });

  it('does not rename another user tags or tag management', async () => {
    const response = mockResponse();
    const request: any = { body: { oldTag: '#old', newTag: '#new' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    insertUser('user');
    insertUser('other-user');
    const ownItem = insertItem('user', 'tt-own');
    const otherItem = insertItem('other-user', 'tt-other');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(ownItem, '#old');
    db.prepare('INSERT INTO collection_item_tags (item_id, tag) VALUES (?, ?)').run(otherItem, '#old');
    insertTagConfig('user', '#old', '#111111', 4);
    insertTagConfig('other-user', '#old', '#333333', 7);

    const { register } = await import('./rename-tag-management-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({
      renamedItemCount: 1,
      tagManagement: [
        {
          tag: '#new',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 4,
        },
      ],
    });
    expect(db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ?').all(ownItem)).toEqual([
      { tag: '#new' },
    ]);
    expect(db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ?').all(otherItem)).toEqual([
      { tag: '#old' },
    ]);
    expect(db.prepare('SELECT tag, color FROM tag_configs WHERE username_hash = ?').all('other-user')).toEqual([
      { tag: '#old', color: '#333333' },
    ]);
  });

  it('does not rename tag management when the caller has no matching item tags', async () => {
    const response = mockResponse();
    const request: any = { body: { oldTag: '#old', newTag: '#new' }, usernameHash: 'user' };
    const { app, handlerPromise } = buildApp(request, response);
    const db = getDatabase();
    insertUser('user');
    insertTagConfig('user', '#old', '#111111', 4);

    const { register } = await import('./rename-tag-management-api');
    register(app);

    await handlerPromise();

    expect(response.send).toHaveBeenCalledWith({
      renamedItemCount: 0,
      tagManagement: [
        {
          tag: '#old',
          color: '#111111',
          useForImageBorder: true,
          useForTextColor: false,
          useForImageBadge: false,
          weight: 4,
        },
      ],
    });
    expect(db.prepare('SELECT tag, color, weight FROM tag_configs WHERE username_hash = ?').all('user')).toEqual([
      { tag: '#old', color: '#111111', weight: 4 },
    ]);
  });
});
