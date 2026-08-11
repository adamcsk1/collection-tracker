import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare, insertShareTestCollectionItem, insertShareTestUser } from '../../test/mocks/share-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const invokePut = async (request: Record<string, unknown>) => {
  const response = mockResponse();
  const { app, handlerPromise } = buildApp(request, response);
  const { register } = await import('./replace-collection-item-shares-api');
  register(app);
  await handlerPromise();
  return response;
};

describe('replace-collection-item-shares-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('atomically creates first selected scope and exact physical selection', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    const itemId = insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: { listType: 'library' },
      body: {
        selections: [
          {
            sharedWithUserShareCode: getUserShareCode('recipient'),
            permissions: { canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          },
        ],
      },
    });

    expect(response.code).toHaveBeenCalledWith(204);
    expect(
      getDatabase()
        .prepare('SELECT scope_mode, can_read, can_create, can_update, can_delete FROM user_share_grants')
        .get()
    ).toEqual({ scope_mode: 'selected', can_read: 1, can_create: 1, can_update: 1, can_delete: 0 });
    expect(getDatabase().prepare('SELECT collection_item_id FROM user_share_item_selections').all()).toEqual([
      { collection_item_id: itemId },
    ]);
  });

  it('shares books through their physical books and book scope', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    const itemId = insertShareTestCollectionItem(getDatabase(), 'owner', '9780306406157', 'books', 'book');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'openlibrary', externalIdentityId: '9780306406157' },
      query: { listType: 'books' },
      body: {
        selections: [
          {
            sharedWithUserShareCode: getUserShareCode('recipient'),
            permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
          },
        ],
      },
    });

    expect(response.code).toHaveBeenCalledWith(204);
    expect(getDatabase().prepare('SELECT list_type, content_type, scope_mode FROM user_share_grants').get()).toEqual({
      list_type: 'books',
      content_type: 'book',
      scope_mode: 'selected',
    });
    expect(getDatabase().prepare('SELECT collection_item_id FROM user_share_item_selections').get()).toEqual({
      collection_item_id: itemId,
    });
  });

  it('rejects duplicate recipients and leaves selections unchanged', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');
    const code = getUserShareCode('recipient');

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: {
        selections: [
          {
            sharedWithUserShareCode: code,
            permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          },
          {
            sharedWithUserShareCode: code,
            permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
          },
        ],
      },
    });

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('rejects redundant selection for broad recipients', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'recipient');

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: { selections: [{ sharedWithUserShareCode: getUserShareCode('recipient') }] },
    });

    expect(response.code).toHaveBeenCalledWith(409);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('does not allow a received item to be reshared', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'viewer');
    insertShareTestUser(getDatabase(), 'recipient');
    insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'viewer');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('viewer', 'recipient');

    const response = await invokePut({
      usernameHash: 'viewer',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: { selections: [] },
    });

    expect(response.code).toHaveBeenCalledWith(404);
  });

  it.each(['invalid', 1])('rejects invalid listType query %s', async (listType) => {
    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: { listType },
      body: { selections: [] },
    });

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it.each([
    { recipientHash: 'owner', createRecipient: false, createRelationship: false },
    { recipientHash: 'unknown', createRecipient: false, createRelationship: false },
    { recipientHash: 'unrelated', createRecipient: true, createRelationship: false },
  ])(
    'rejects self, unknown, and unrelated recipient $recipientHash without changing shares',
    async ({ recipientHash, createRecipient, createRelationship }) => {
      insertShareTestUser(getDatabase(), 'owner');
      if (createRecipient) insertShareTestUser(getDatabase(), recipientHash);
      insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
      if (createRelationship) {
        getDatabase()
          .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
          .run('owner', recipientHash);
      }

      const response = await invokePut({
        usernameHash: 'owner',
        params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
        query: {},
        body: { selections: [{ sharedWithUserShareCode: getUserShareCode(recipientHash) }] },
      });

      expect(response.code).toHaveBeenCalledWith(404);
      expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
      expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
    }
  );

  it('requires readable permissions for a recipient first selected scope', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: { selections: [{ sharedWithUserShareCode: getUserShareCode('recipient') }] },
    });

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('rejects canRead false for an existing selected recipient without mutation', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'recipient');
    const itemId = insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    getDatabase().exec(`
      INSERT INTO user_shares (owner_username_hash, shared_with_username_hash)
      VALUES ('owner', 'recipient');
      INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type,
         can_read, can_create, can_update, can_delete, scope_mode)
      VALUES ('owner', 'recipient', 'library', 'movie', 1, 0, 1, 0, 'selected');
    `);
    getDatabase()
      .prepare(
        `INSERT INTO user_share_item_selections
         (owner_username_hash, shared_with_username_hash, collection_item_id)
         VALUES ('owner', 'recipient', ?)`
      )
      .run(itemId);
    const grantsBefore = getDatabase().prepare('SELECT * FROM user_share_grants').all();
    const selectionsBefore = getDatabase().prepare('SELECT * FROM user_share_item_selections').all();

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: {
        selections: [
          {
            sharedWithUserShareCode: getUserShareCode('recipient'),
            permissions: { canRead: false, canCreate: true, canUpdate: false, canDelete: true },
          },
        ],
      },
    });

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual(grantsBefore);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual(selectionsBefore);
  });

  it('rolls back earlier replacements when a later broad recipient is rejected', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'existing');
    insertShareTestUser(getDatabase(), 'new-recipient');
    insertShareTestUser(getDatabase(), 'broad');
    const itemId = insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    for (const recipientHash of ['existing', 'new-recipient', 'broad']) {
      getDatabase()
        .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
        .run('owner', recipientHash);
    }
    getDatabase().exec(`
      INSERT INTO user_share_grants
        (owner_username_hash, shared_with_username_hash, list_type, content_type, can_read, scope_mode)
      VALUES
        ('owner', 'existing', 'library', 'movie', 1, 'selected'),
        ('owner', 'broad', 'library', 'movie', 1, 'all');
    `);
    getDatabase()
      .prepare(
        `INSERT INTO user_share_item_selections
         (owner_username_hash, shared_with_username_hash, collection_item_id) VALUES ('owner', 'existing', ?)`
      )
      .run(itemId);
    const grantsBefore = getDatabase().prepare('SELECT * FROM user_share_grants ORDER BY id').all();
    const selectionsBefore = getDatabase().prepare('SELECT * FROM user_share_item_selections').all();

    const response = await invokePut({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
      body: {
        selections: [
          {
            sharedWithUserShareCode: getUserShareCode('new-recipient'),
            permissions: { canRead: true, canCreate: false, canUpdate: true, canDelete: false },
          },
          { sharedWithUserShareCode: getUserShareCode('broad') },
        ],
      },
    });

    expect(response.code).toHaveBeenCalledWith(409);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants ORDER BY id').all()).toEqual(grantsBefore);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual(selectionsBefore);
  });

  it.each([
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: '' },
      body: { selections: [] },
    },
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      body: { selections: [], unexpected: true },
    },
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      body: { selections: {} },
    },
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      body: { selections: [{ sharedWithUserShareCode: ' ', permissions: undefined }] },
    },
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      body: {
        selections: [
          {
            sharedWithUserShareCode: 'code',
            permissions: {
              canRead: true,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
              unexpected: true,
            },
          },
        ],
      },
    },
    {
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      body: {
        selections: [
          {
            sharedWithUserShareCode: 'code',
            permissions: { canRead: true, canCreate: false, canUpdate: false },
          },
        ],
      },
    },
  ])('rejects malformed PUT payloads and identities', async ({ params, body }) => {
    const response = await invokePut({ usernameHash: 'owner', params, query: {}, body });

    expect(response.code).toHaveBeenCalledWith(400);
  });
});
