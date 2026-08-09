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

    const allItems = searchCollectionItems(getDatabase(), 'viewer', { offset: 0, limit: 20 });
    const ownItems = searchCollectionItems(getDatabase(), 'viewer', {
      filters: { shared: 'mine' },
      offset: 0,
      limit: 20,
    });
    const sharedBooks = searchCollectionItems(getDatabase(), 'viewer', {
      filters: { shared: 'shared', type: 'book' },
      offset: 0,
      limit: 20,
    });

    expect(allItems.total).toBe(4);
    expect(allItems.items.map(({ title }) => title)).toEqual(
      expect.arrayContaining(['Own Movie', 'Own Book', 'Shared Movie', 'Shared Book'])
    );
    expect(allItems.items.map(({ title }) => title)).not.toContain('Private Series');
    expect(ownItems).toEqual(expect.objectContaining({ total: 2 }));
    expect(ownItems.items.map(({ title }) => title)).toEqual(expect.arrayContaining(['Own Movie', 'Own Book']));
    expect(sharedBooks).toEqual(expect.objectContaining({ total: 1 }));
    expect(sharedBooks.items[0]).toEqual(expect.objectContaining({ title: 'Shared Book', listType: 'books' }));
  });

  it('paginates across many readable shares without expanding SQLite expression depth', () => {
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
      offset: 1000,
      limit: 25,
    });

    expect(result).toEqual(expect.objectContaining({ total: 1100, offset: 1000, limit: 25 }));
    expect(result.items).toHaveLength(25);
    expect(result.items[0]).toEqual(expect.objectContaining({ title: 'Shared 1000' }));
    expect(result.items[24]).toEqual(expect.objectContaining({ title: 'Shared 1024' }));
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
      offset: 0,
      limit: 20,
    });

    expect(result).toEqual(expect.objectContaining({ total: 401 }));
    expect(result.items.slice(0, 2).map(({ title }) => title)).toEqual(['Owner 400', 'Owner 399']);
  });
});
