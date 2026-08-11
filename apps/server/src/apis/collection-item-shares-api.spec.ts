import { API_PREFIX } from '@shared/constants/api-const';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare } from '../../test/mocks/share-mock';
import { getDatabase } from '../core/database/database';
import { getUserShareCode } from '../core/database/repositories/user-repository';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, usernameHash);
};

const insertItem = (
  ownerHash: string,
  externalItemId: string,
  listType: 'library' | 'books' = 'library',
  contentType: 'movie' | 'book' = 'movie'
): number => {
  const externalProvider = contentType === 'book' ? 'openlibrary' : 'imdb';
  const result = getDatabase()
    .prepare(
      `INSERT INTO collection_items
       (username_hash, external_provider, external_item_id, canonical_item_id, list_type, content_type,
        title, title_lower, year, contributors, description, image, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '', '', '', ?)`
    )
    .run(
      ownerHash,
      externalProvider,
      externalItemId,
      `${externalProvider}:${externalItemId}`,
      listType,
      contentType,
      externalItemId,
      externalItemId,
      `${externalItemId}-hash`
    );
  return Number(result.lastInsertRowid);
};

const invokeGet = async (request: Record<string, unknown>) => {
  const handlers = new Map<string, (routeRequest: any, routeResponse: any) => Promise<void>>();
  const app = {
    get: vi.fn((path: string, _options: unknown, handler: any) => handlers.set(path, handler)),
    put: vi.fn(),
  } as unknown as FastifyInstance;
  const { register } = await import('./collection-item-shares-api');
  register(app);
  const response = mockResponse();
  await handlers.get(`${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/shares`)!(
    request,
    response
  );
  return response;
};

describe('collection-item-shares-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('atomically creates first selected scope and exact physical selection', async () => {
    insertUser('owner');
    insertUser('recipient');
    const itemId = insertItem('owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');
    const response = mockResponse();
    const request: any = {
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
    };
    const { app, handlerPromise } = buildApp(request, response);
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

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
    insertUser('owner');
    insertUser('recipient');
    const itemId = insertItem('owner', '9780306406157', 'books', 'book');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
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
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

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
    insertUser('owner');
    insertUser('recipient');
    insertItem('owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');
    const code = getUserShareCode('recipient');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
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
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('rejects redundant selection for broad recipients', async () => {
    insertUser('owner');
    insertUser('recipient');
    insertItem('owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'recipient');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'owner',
        params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
        query: {},
        body: { selections: [{ sharedWithUserShareCode: getUserShareCode('recipient') }] },
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(409);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('returns all outgoing relationships and item-specific read state', async () => {
    insertUser('owner');
    insertUser('broad');
    insertUser('empty');
    insertItem('owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'broad');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'empty');
    const handlers = new Map<string, (request: any, response: any) => Promise<void>>();
    const app = {
      get: vi.fn((path: string, _options: unknown, handler: any) => handlers.set(path, handler)),
      put: vi.fn(),
    } as unknown as FastifyInstance;
    const { register } = await import('./collection-item-shares-api');
    register(app);
    const response = mockResponse();

    await handlers.get(`${API_PREFIX}/collection-items/:externalIdentitySource/:externalIdentityId/shares`)!(
      {
        usernameHash: 'owner',
        params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
        query: {},
      },
      response
    );

    expect(response.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sharedWithUsername: 'broad', readMode: 'all' }),
        expect.objectContaining({ sharedWithUsername: 'empty', readMode: 'none', permissions: null }),
      ])
    );
  });

  it('does not allow a received item to be reshared', async () => {
    insertUser('owner');
    insertUser('viewer');
    insertUser('recipient');
    insertItem('owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'viewer');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('viewer', 'recipient');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'viewer',
        params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
        query: {},
        body: { selections: [] },
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(404);
  });

  it.each(['invalid', 1])('rejects invalid listType queries for GET and PUT', async (listType) => {
    const request = {
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: { listType },
    };
    const getResponse = await invokeGet(request);
    expect(getResponse.code).toHaveBeenCalledWith(400);

    const putResponse = mockResponse();
    const { app, handlerPromise } = buildApp({ ...request, body: { selections: [] } }, putResponse);
    const { register } = await import('./collection-item-shares-api');
    register(app);
    await handlerPromise();
    expect(putResponse.code).toHaveBeenCalledWith(400);
  });

  it('does not return another owner item from GET', async () => {
    insertUser('requester');
    insertUser('foreign-owner');
    insertItem('foreign-owner', 'tt-foreign');

    const response = await invokeGet({
      usernameHash: 'requester',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-foreign' },
      query: {},
    });

    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).not.toHaveBeenCalledWith(expect.any(Array));
  });

  it.each([
    { recipientHash: 'owner', createRecipient: false, createRelationship: false },
    { recipientHash: 'unknown', createRecipient: false, createRelationship: false },
    { recipientHash: 'unrelated', createRecipient: true, createRelationship: false },
  ])(
    'rejects self, unknown, and unrelated recipient $recipientHash without changing shares',
    async ({ recipientHash, createRecipient, createRelationship }) => {
      insertUser('owner');
      if (createRecipient) insertUser(recipientHash);
      insertItem('owner', 'tt-one');
      if (createRelationship) {
        getDatabase()
          .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
          .run('owner', recipientHash);
      }
      const response = mockResponse();
      const { app, handlerPromise } = buildApp(
        {
          usernameHash: 'owner',
          params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
          query: {},
          body: { selections: [{ sharedWithUserShareCode: getUserShareCode(recipientHash) }] },
        },
        response
      );
      const { register } = await import('./collection-item-shares-api');
      register(app);

      await handlerPromise();

      expect(response.code).toHaveBeenCalledWith(404);
      expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
      expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
    }
  );

  it('requires readable permissions for a recipient first selected scope', async () => {
    insertUser('owner');
    insertUser('recipient');
    insertItem('owner', 'tt-one');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'recipient');
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
        usernameHash: 'owner',
        params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
        query: {},
        body: { selections: [{ sharedWithUserShareCode: getUserShareCode('recipient') }] },
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual([]);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual([]);
  });

  it('rejects canRead false for an existing selected recipient without mutation', async () => {
    insertUser('owner');
    insertUser('recipient');
    const itemId = insertItem('owner', 'tt-one');
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
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
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
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
    expect(getDatabase().prepare('SELECT * FROM user_share_grants').all()).toEqual(grantsBefore);
    expect(getDatabase().prepare('SELECT * FROM user_share_item_selections').all()).toEqual(selectionsBefore);
  });

  it('rolls back earlier replacements when a later broad recipient is rejected', async () => {
    insertUser('owner');
    insertUser('existing');
    insertUser('new-recipient');
    insertUser('broad');
    const itemId = insertItem('owner', 'tt-one');
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
    const response = mockResponse();
    const { app, handlerPromise } = buildApp(
      {
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
      },
      response
    );
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

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
    const response = mockResponse();
    const { app, handlerPromise } = buildApp({ usernameHash: 'owner', params, query: {}, body }, response);
    const { register } = await import('./collection-item-shares-api');
    register(app);

    await handlerPromise();

    expect(response.code).toHaveBeenCalledWith(400);
  });
});
