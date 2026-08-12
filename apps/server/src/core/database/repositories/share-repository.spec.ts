import { getDatabase } from '../database';
import { insertShare, libraryGrants } from '../../../../test/mocks/share-mock';
import { describe, expect, it, vi } from 'vitest';
import {
  canAccessShare,
  findAccessibleShareItemIds,
  findSharesForUser,
  hasUserShareRelationship,
  deleteShare,
  replaceCollectionItemSelections,
  upsertShare,
} from './share-repository';
import type { CollectionItemRow } from './collection/collection-model';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, usernameHash);
};

describe('share-repository', () => {
  it('loads and groups hundreds of incoming and outgoing shares', () => {
    const db = getDatabase();
    insertUser('viewer');
    db.transaction(() => {
      for (let shareIndex = 0; shareIndex < 150; shareIndex += 1) {
        const ownerHash = `owner-${shareIndex}`;
        const recipientHash = `recipient-${shareIndex}`;
        insertUser(ownerHash);
        insertUser(recipientHash);
        insertShare(
          db,
          ownerHash,
          'viewer',
          libraryGrants(shareIndex === 149 ? { canCreate: true } : { canRead: true })
        );
        insertShare(
          db,
          'viewer',
          recipientHash,
          libraryGrants(shareIndex === 149 ? { canDelete: true } : { canRead: true, canUpdate: true })
        );
      }
    })();

    const prepareSpy = vi.spyOn(db, 'prepare');
    const shares = findSharesForUser(db, 'viewer');
    const query = prepareSpy.mock.calls[0]?.[0];
    prepareSpy.mockRestore();
    expect(typeof query).toBe('string');
    if (typeof query !== 'string') throw new Error('Expected share query');
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all('viewer', 'viewer') as Array<{ detail: string }>;

    expect(shares).toHaveLength(300);
    expect(shares.filter(({ direction }) => direction === 'incoming')).toHaveLength(150);
    expect(shares.filter(({ direction }) => direction === 'outgoing')).toHaveLength(150);
    expect(shares).toContainEqual(
      expect.objectContaining({
        direction: 'incoming',
        counterpartUsername: 'owner-149',
        grants: libraryGrants({ canCreate: true }),
      })
    );
    expect(shares).toContainEqual(
      expect.objectContaining({
        direction: 'outgoing',
        counterpartUsername: 'recipient-149',
        grants: libraryGrants({ canDelete: true }),
      })
    );
    expect(plan.some(({ detail }) => /SEARCH user_shares.*owner_username_hash=\?/.test(detail))).toBe(true);
    expect(plan.some(({ detail }) => /SEARCH user_shares.*shared_with_username_hash=\?/.test(detail))).toBe(true);
    expect(plan.some(({ detail }) => /SEARCH grants.*USING .*INDEX/.test(detail))).toBe(true);
  });

  it('limits selected permissions to selected rows and clears grant after last removal', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    db.prepare(
      `INSERT INTO collection_items
       (username_hash, external_provider, external_item_id, list_type, content_type,
        title, title_lower, year, contributors, description, image, content_hash)
       VALUES ('owner', 'imdb', 'one', 'library', 'movie', 'One', 'one', '', '', '', '', 'one')`
    ).run();
    insertShare(db, 'owner', 'viewer', []);
    const item = db.prepare("SELECT * FROM collection_items WHERE external_item_id = 'one'").get() as CollectionItemRow;
    replaceCollectionItemSelections(db, 'owner', item, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      },
    ]);

    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'read', item.id)).toBe(true);
    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'update', item.id)).toBe(true);
    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'read')).toBe(false);
    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'update')).toBe(false);
    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'delete')).toBe(false);
    expect(canAccessShare(db, 'viewer', 'owner', 'library', 'movie', 'create')).toBe(true);
    db.prepare(
      `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
       VALUES ('viewer', 'library', 'movie', 'owner')`
    ).run();

    replaceCollectionItemSelections(db, 'owner', item, []);
    expect(db.prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM collection_owner_defaults').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM user_shares').all()).toHaveLength(1);
  });

  it('promotes selected scope to all and removes redundant selections', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    db.prepare(
      `INSERT INTO collection_items
       (username_hash, external_provider, external_item_id, list_type, content_type,
        title, title_lower, year, contributors, description, image, content_hash)
       VALUES ('owner', 'imdb', 'one', 'library', 'movie', 'One', 'one', '', '', '', '', 'one')`
    ).run();
    insertShare(db, 'owner', 'viewer', []);
    const item = db.prepare("SELECT * FROM collection_items WHERE external_item_id = 'one'").get() as CollectionItemRow;
    replaceCollectionItemSelections(db, 'owner', item, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
      },
    ]);

    insertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all',
      },
    ]);

    expect(db.prepare('SELECT scope_mode FROM user_share_grants').all()).toEqual([{ scope_mode: 'all' }]);
    expect(db.prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('reconciles grants by exact physical scope without erasing preserved selections', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    db.exec(`
      INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
      VALUES
        ('owner', 'imdb', 'movie', 'library', 'movie', 'Movie', 'movie', '', '', '', '', 'movie'),
        ('owner', 'openlibrary', 'book', 'books', 'book', 'Book', 'book', '', '', '', '', 'book');
    `);
    insertShare(db, 'owner', 'viewer', []);
    const movie = db
      .prepare("SELECT * FROM collection_items WHERE external_item_id = 'movie'")
      .get() as CollectionItemRow;
    const book = db
      .prepare("SELECT * FROM collection_items WHERE external_item_id = 'book'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(db, 'owner', movie, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    replaceCollectionItemSelections(db, 'owner', book, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: true },
      },
    ]);

    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        readMode: 'selected',
      },
      {
        listType: 'books',
        contentType: 'book',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: true,
        readMode: 'selected',
      },
    ]);

    expect(
      db
        .prepare(
          `SELECT list_type, content_type, can_create, can_update, can_delete, scope_mode
           FROM user_share_grants ORDER BY list_type`
        )
        .all()
    ).toEqual([
      {
        list_type: 'books',
        content_type: 'book',
        can_create: 0,
        can_update: 0,
        can_delete: 1,
        scope_mode: 'selected',
      },
      {
        list_type: 'library',
        content_type: 'movie',
        can_create: 1,
        can_update: 1,
        can_delete: 0,
        scope_mode: 'selected',
      },
    ]);
    expect(
      db.prepare('SELECT collection_item_id FROM user_share_item_selections ORDER BY collection_item_id').all()
    ).toEqual([{ collection_item_id: movie.id }, { collection_item_id: book.id }]);

    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: false,
        readMode: 'all',
      },
      {
        listType: 'books',
        contentType: 'book',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: true,
        readMode: 'selected',
      },
    ]);
    expect(db.prepare('SELECT collection_item_id FROM user_share_item_selections').all()).toEqual([
      { collection_item_id: book.id },
    ]);

    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'books',
        contentType: 'book',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: true,
        readMode: 'selected',
      },
    ]);
    expect(db.prepare('SELECT list_type, scope_mode FROM user_share_grants').all()).toEqual([
      { list_type: 'books', scope_mode: 'selected' },
    ]);
    expect(db.prepare('SELECT collection_item_id FROM user_share_item_selections').all()).toEqual([
      { collection_item_id: book.id },
    ]);

    upsertShare(db, 'owner', 'viewer', []);
    expect(db.prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM user_shares').all()).toHaveLength(1);
  });

  it('removes all scopes requested as selected when no explicit selections exist', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    db.exec(`
      INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
      VALUES
        ('owner', 'imdb', 'movie', 'library', 'movie', 'Movie', 'movie', '', '', '', '', 'movie'),
        ('owner', 'imdb', 'series', 'library', 'series', 'Series', 'series', '', '', '', '', 'series');
    `);
    insertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
      {
        listType: 'library',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'selected',
      },
      {
        listType: 'library',
        contentType: 'series',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'selected',
      },
    ]);

    expect(db.prepare('SELECT content_type, scope_mode FROM user_share_grants').all()).toEqual([]);
    expect(db.prepare('SELECT collection_item_id FROM user_share_item_selections').all()).toEqual([]);
  });

  it('checks an exact outgoing relationship independently of grants', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    insertUser('other');
    insertShare(db, 'owner', 'viewer', []);

    expect(hasUserShareRelationship(db, 'owner', 'viewer')).toBe(true);
    expect(hasUserShareRelationship(db, 'viewer', 'owner')).toBe(false);
    expect(hasUserShareRelationship(db, 'owner', 'other')).toBe(false);
  });

  it('clears only defaults whose exact Add permission is removed', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    insertShare(db, 'owner', 'viewer', libraryGrants({ canCreate: true }));
    db.prepare(
      `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
       VALUES ('viewer', 'library', 'movie', ?), ('viewer', 'library', 'series', ?)`
    ).run('owner', 'owner');

    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'series',
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
        readMode: 'all',
      },
    ]);

    expect(db.prepare('SELECT content_type FROM collection_owner_defaults').all()).toEqual([
      { content_type: 'series' },
    ]);
  });

  it('clears all defaults targeting a deleted share owner', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    insertShare(db, 'owner', 'viewer', libraryGrants({ canCreate: true }));
    db.prepare(
      `INSERT INTO collection_owner_defaults (username_hash, list_type, content_type, owner_username_hash)
       VALUES ('viewer', 'library', 'movie', ?), ('viewer', 'library', 'series', ?)`
    ).run('owner', 'owner');

    deleteShare(db, 'owner', 'viewer');

    expect(db.prepare('SELECT * FROM collection_owner_defaults').all()).toEqual([]);
  });

  it('resolves selected bulk access without authorizing hidden siblings', () => {
    const db = getDatabase();
    insertUser('owner');
    insertUser('viewer');
    db.exec(`
      INSERT INTO collection_items
        (username_hash, external_provider, external_item_id, list_type, content_type,
         title, title_lower, year, contributors, description, image, content_hash)
      VALUES
        ('owner', 'imdb', 'selected', 'library', 'movie', 'Selected', 'selected', '', '', '', '', 'selected'),
        ('owner', 'imdb', 'hidden', 'library', 'movie', 'Hidden', 'hidden', '', '', '', '', 'hidden');
    `);
    insertShare(db, 'owner', 'viewer', []);
    const selectedItem = db
      .prepare("SELECT * FROM collection_items WHERE external_item_id = 'selected'")
      .get() as CollectionItemRow;
    replaceCollectionItemSelections(db, 'owner', selectedItem, [
      {
        sharedWithUsernameHash: 'viewer',
        permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
      },
    ]);

    expect(findAccessibleShareItemIds(db, 'viewer', 'owner', 'library', ['movie'], 'read')).toEqual({
      authorized: true,
      itemIds: [selectedItem.id],
    });
    expect(findAccessibleShareItemIds(db, 'viewer', 'owner', 'library', ['movie'], 'delete')).toEqual({
      authorized: false,
      itemIds: [],
    });

    upsertShare(db, 'owner', 'viewer', [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all',
      },
    ]);
    expect(findAccessibleShareItemIds(db, 'viewer', 'owner', 'library', ['movie'], 'update')).toEqual({
      authorized: true,
      itemIds: expect.arrayContaining([
        selectedItem.id,
        (db.prepare("SELECT id FROM collection_items WHERE external_item_id = 'hidden'").get() as { id: number }).id,
      ]),
    });
  });
});
