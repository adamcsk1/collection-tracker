import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../../database';
import { searchCollectionItems } from './collection-read-repository';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)')
    .run(usernameHash, `${usernameHash}-token`);
};

const insertItem = (
  usernameHash: string,
  externalItemId: string,
  title: string,
  listType: 'library' | 'books' = 'library',
  contentType: 'movie' | 'series' | 'book' = 'movie'
): void => {
  getDatabase()
    .prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', ?)`
    )
    .run(
      usernameHash,
      contentType === 'book' ? 'openlibrary' : 'imdb',
      externalItemId,
      `${contentType}:${externalItemId}`,
      listType,
      contentType,
      title,
      title.toLowerCase(),
      `${usernameHash}-${externalItemId}-${listType}`
    );
};

const insertGrant = (
  ownerHash: string,
  viewerHash: string,
  listType: 'library' | 'books',
  contentType: 'movie' | 'series' | 'book',
  canRead = true
): void => {
  getDatabase()
    .prepare(
      `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ownerHash, viewerHash, listType, contentType, canRead ? 1 : 0);
};

describe('collection-read-repository scoped reads', () => {
  process.env.COOKIE_SECRET = 'collection-read-repository-secret';

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('applies own/shared filters, exact content grants, and folded books', () => {
    insertUser('viewer');
    insertUser('owner');
    insertItem('viewer', 'own-movie', 'Own Movie');
    insertItem('viewer', 'own-book', 'Own Book', 'books', 'book');
    insertItem('owner', 'shared-movie', 'Shared Movie');
    insertItem('owner', 'private-series', 'Private Series', 'library', 'series');
    insertItem('owner', 'shared-book', 'Shared Book', 'books', 'book');
    insertGrant('owner', 'viewer', 'library', 'movie');
    insertGrant('owner', 'viewer', 'library', 'series', false);
    insertGrant('owner', 'viewer', 'books', 'book');

    const allItems = searchCollectionItems(getDatabase(), 'viewer', { limit: 20 });
    const ownItems = searchCollectionItems(getDatabase(), 'viewer', {
      filters: { shared: 'mine' },
      limit: 20,
    });
    const sharedBooks = searchCollectionItems(getDatabase(), 'viewer', {
      filters: { shared: 'shared', type: 'book' },
      limit: 20,
    });

    expect(allItems.page).toEqual({ limit: 20, hasMore: false, nextCursor: null });
    expect(allItems.items.map(({ title }) => title)).toEqual(
      expect.arrayContaining(['Own Movie', 'Own Book', 'Shared Movie', 'Shared Book'])
    );
    expect(allItems.items.map(({ title }) => title)).not.toContain('Private Series');
    expect(ownItems.page.hasMore).toBe(false);
    expect(ownItems.items.map(({ title }) => title)).toEqual(expect.arrayContaining(['Own Movie', 'Own Book']));
    expect(sharedBooks.page.hasMore).toBe(false);
    expect(sharedBooks.items[0]).toEqual(expect.objectContaining({ title: 'Shared Book', listType: 'books' }));
  });

  it.each([
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
    ['alphabet', 'asc'],
    ['alphabet', 'desc'],
  ] as const)('keyset paginates duplicate %s values in %s order', (orderBy, orderDirection) => {
    insertUser('viewer');
    insertItem('viewer', 'one', 'Same');
    insertItem('viewer', 'two', 'Same');
    insertItem('viewer', 'three', 'Same');

    const filters = { orderBy, orderDirection };
    const firstPage = searchCollectionItems(getDatabase(), 'viewer', { filters, limit: 2 });
    const secondPage = searchCollectionItems(getDatabase(), 'viewer', {
      filters,
      cursor: firstPage.page.nextCursor ?? undefined,
      limit: 2,
    });

    expect(firstPage.page).toEqual({ limit: 2, hasMore: true, nextCursor: expect.any(String) });
    expect(secondPage.page).toEqual({ limit: 2, hasMore: false, nextCursor: null });
    expect([...firstPage.items, ...secondPage.items].map((item) => item.externalItemId)).toHaveLength(3);
    expect(new Set([...firstPage.items, ...secondPage.items].map((item) => item.externalItemId)).size).toBe(3);
  });

  it('does not shift a created-desc page when a newer item is inserted', () => {
    insertUser('viewer');
    insertItem('viewer', 'one', 'One');
    insertItem('viewer', 'two', 'Two');
    insertItem('viewer', 'three', 'Three');
    const filters = { orderBy: 'createdAt' as const, orderDirection: 'desc' as const };
    const firstPage = searchCollectionItems(getDatabase(), 'viewer', { filters, limit: 2 });

    insertItem('viewer', 'new', 'New');
    const secondPage = searchCollectionItems(getDatabase(), 'viewer', {
      filters,
      cursor: firstPage.page.nextCursor ?? undefined,
      limit: 2,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].externalItemId).not.toBe('new');
  });

  it.each([
    ['createdAt', 'asc'],
    ['createdAt', 'desc'],
    ['alphabet', 'asc'],
    ['alphabet', 'desc'],
  ] as const)(
    'does not repeat the cursor item when its %s sort value changes in %s order',
    (orderBy, orderDirection) => {
      const db = getDatabase();
      insertUser('viewer');
      insertItem('viewer', 'alpha', 'Alpha');
      insertItem('viewer', 'bravo', 'Bravo');
      insertItem('viewer', 'charlie', 'Charlie');
      insertItem('viewer', 'delta', 'Delta');
      const updateCreatedAt = db.prepare('UPDATE collection_items SET created_at = ? WHERE external_item_id = ?');
      updateCreatedAt.run('2026-01-01 00:00:01', 'alpha');
      updateCreatedAt.run('2026-01-01 00:00:02', 'bravo');
      updateCreatedAt.run('2026-01-01 00:00:03', 'charlie');
      updateCreatedAt.run('2026-01-01 00:00:04', 'delta');
      const filters = { orderBy, orderDirection };
      const firstPage = searchCollectionItems(db, 'viewer', { filters, limit: 2 });
      const cursorItem = firstPage.items.at(-1);
      expect(cursorItem).toBeDefined();

      if (orderBy === 'alphabet') {
        const updatedTitle = orderDirection === 'asc' ? 'Zulu' : 'Able';
        db.prepare('UPDATE collection_items SET title = ?, title_lower = ? WHERE external_item_id = ?').run(
          updatedTitle,
          updatedTitle.toLowerCase(),
          cursorItem?.externalItemId
        );
      } else {
        const updatedCreatedAt = orderDirection === 'asc' ? '2026-01-01 00:00:05' : '2026-01-01 00:00:00';
        updateCreatedAt.run(updatedCreatedAt, cursorItem?.externalItemId);
      }

      const secondPage = searchCollectionItems(db, 'viewer', {
        filters,
        cursor: firstPage.page.nextCursor ?? undefined,
        limit: 10,
      });
      const returnedIds = [...firstPage.items, ...secondPage.items].map((item) => item.externalItemId);

      expect(returnedIds).toHaveLength(4);
      expect(new Set(returnedIds)).toEqual(new Set(['alpha', 'bravo', 'charlie', 'delta']));
    }
  );

  it('paginates readable shares without expanding SQLite expression depth', () => {
    const db = getDatabase();
    insertUser('viewer');
    const insertUserStatement = db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)');
    const insertGrantStatement = db.prepare(
      `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES (?, 'viewer', 'library', 'movie', 1)`
    );
    const insertItemStatement = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash, created_at)
       VALUES (?, 'imdb', ?, ?, 'library', 'movie', ?, ?, '', '', '', '', ?, ?)`
    );
    const insertShares = db.transaction(() => {
      for (let shareIndex = 0; shareIndex < 1100; shareIndex += 1) {
        const ownerHash = `owner-${shareIndex}`;
        const externalItemId = `shared-${shareIndex}`;
        const title = `Shared ${shareIndex.toString().padStart(4, '0')}`;
        insertUserStatement.run(ownerHash, `${ownerHash}-token`);
        insertGrantStatement.run(ownerHash);
        insertItemStatement.run(
          ownerHash,
          externalItemId,
          `movie:${externalItemId}`,
          title,
          title.toLowerCase(),
          `${externalItemId}-hash`,
          `2026-01-01 00:${String(Math.floor(shareIndex / 60)).padStart(2, '0')}:${String(shareIndex % 60).padStart(2, '0')}`
        );
      }
    });
    insertShares();

    const result = searchCollectionItems(db, 'viewer', {
      filters: { shared: 'shared', orderBy: 'alphabet', orderDirection: 'asc' },
      limit: 25,
    });

    expect(result.page).toEqual({ limit: 25, hasMore: true, nextCursor: expect.any(String) });
    expect(result.items).toHaveLength(25);
    expect(result.items[0]).toEqual(expect.objectContaining({ title: 'Shared 0000' }));
    expect(result.items[24]).toEqual(expect.objectContaining({ title: 'Shared 0024' }));
  });

  it('matches and ranks aliases across large identity and owner batches', () => {
    const db = getDatabase();
    insertUser('viewer');
    const insertUserStatement = db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)');
    const insertItemStatement = db.prepare(
      `INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, 'imdb', ?, ?, 'library', 'movie', ?, ?, '', '', '', '', ?)`
    );
    const insertGrantStatement = db.prepare(
      `INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read)
       VALUES (?, 'viewer', 'library', 'movie', 1)`
    );
    const insertAliasStatement = db.prepare(
      `INSERT INTO external_item_identities
        (username_hash, canonical_item_id, external_provider, external_item_id, source_confidence)
       VALUES (?, ?, 'omdb', ?, 'alias')`
    );
    db.transaction(() => {
      for (let ownerIndex = 0; ownerIndex < 401; ownerIndex += 1) {
        const ownerHash = `owner-${ownerIndex}`;
        const externalItemId = `primary-${ownerIndex}`;
        const canonicalItemId = `movie:${externalItemId}`;
        const title = `Owner ${ownerIndex}`;
        insertUserStatement.run(ownerHash, `${ownerHash}-token`);
        insertItemStatement.run(
          ownerHash,
          externalItemId,
          canonicalItemId,
          title,
          title.toLowerCase(),
          `${externalItemId}-hash`
        );
        insertGrantStatement.run(ownerHash);
        insertAliasStatement.run(ownerHash, canonicalItemId, `alias-${ownerIndex}`);
      }
    })();
    const matchedIdentities = Array.from({ length: 401 }, (_, index) => ({
      source: 'omdb' as const,
      id: `alias-${400 - index}`,
    }));

    const result = searchCollectionItems(db, 'viewer', {
      filters: { shared: 'shared' },
      matchedIdentities,
      limit: 20,
    });

    expect(result.page).toEqual({ limit: 20, hasMore: true, nextCursor: expect.any(String) });
    expect(result.items.slice(0, 2).map(({ title }) => title)).toEqual(['Owner 400', 'Owner 399']);
  });
});
