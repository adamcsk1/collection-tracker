import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../test/mocks/build-app-mock';
import { mockResponse } from '../../test/mocks/response-mock';
import { insertLibraryShare, insertShareTestCollectionItem, insertShareTestUser } from '../../test/mocks/share-mock';
import { getDatabase } from '../core/database/database';

const invokeGet = async (request: Record<string, unknown>) => {
  const response = mockResponse();
  const { app, handlerPromise } = buildApp(request, response);
  const { register } = await import('./get-collection-item-shares-api');
  register(app);
  await handlerPromise();
  return response;
};

describe('get-collection-item-shares-api', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns all outgoing relationships and item-specific read state', async () => {
    insertShareTestUser(getDatabase(), 'owner');
    insertShareTestUser(getDatabase(), 'broad');
    insertShareTestUser(getDatabase(), 'empty');
    insertShareTestCollectionItem(getDatabase(), 'owner', 'tt-one');
    insertLibraryShare(getDatabase(), 'owner', 'broad');
    getDatabase()
      .prepare('INSERT INTO user_shares (owner_username_hash, shared_with_username_hash) VALUES (?, ?)')
      .run('owner', 'empty');

    const response = await invokeGet({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: {},
    });

    expect(response.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sharedWithUsername: 'broad', readMode: 'all' }),
        expect.objectContaining({ sharedWithUsername: 'empty', readMode: 'none', permissions: null }),
      ])
    );
  });

  it.each(['invalid', 1])('rejects invalid listType query %s', async (listType) => {
    const response = await invokeGet({
      usernameHash: 'owner',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-one' },
      query: { listType },
    });

    expect(response.code).toHaveBeenCalledWith(400);
  });

  it('does not return another owner item', async () => {
    insertShareTestUser(getDatabase(), 'requester');
    insertShareTestUser(getDatabase(), 'foreign-owner');
    insertShareTestCollectionItem(getDatabase(), 'foreign-owner', 'tt-foreign');

    const response = await invokeGet({
      usernameHash: 'requester',
      params: { externalIdentitySource: 'imdb', externalIdentityId: 'tt-foreign' },
      query: {},
    });

    expect(response.code).toHaveBeenCalledWith(404);
    expect(response.send).not.toHaveBeenCalledWith(expect.any(Array));
  });
});
