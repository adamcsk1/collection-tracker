import { expect, type APIResponse, type Page } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import type {
  ApiEnvelope,
  ItemShareSelection,
  ItemShareState,
  ShareContentType,
  ShareGrant,
  ShareGrantReadMode,
  ShareListType,
  SharePermissions,
  ShareReadMode,
  TestUser,
} from './share-helper-model';
import type { ApiClient } from './test';

let imdbIdCounter = 0;

export const uniqueId = (): string => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

export const uniqueImdbId = (): string => {
  imdbIdCounter += 1;
  return `tt${Date.now()}${imdbIdCounter}`;
};

const resetPermissionStorage = (): void => {
  window.sessionStorage.removeItem('CT.AppMode');
  window.sessionStorage.removeItem('CT.SettingLock');
  window.localStorage.setItem('CT.AppMode', 'full');
  window.localStorage.removeItem('CT.SettingLock');
};

const toCookieHeader = (response: APIResponse): string =>
  response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value.split(';')[0])
    .filter((cookie) => cookie.startsWith('CT.Token=') || cookie.startsWith('CT.RefreshToken='))
    .join('; ');

export const grant = (
  listType: ShareListType,
  contentType: ShareContentType,
  permissions: Partial<SharePermissions> & { readMode?: ShareGrantReadMode } = { canRead: true }
): ShareGrant => {
  const canCreate = permissions.canCreate === true;
  const canUpdate = permissions.canUpdate === true;
  const canDelete = permissions.canDelete === true;
  const canRead = permissions.canRead === true || canCreate || canUpdate || canDelete;

  return {
    listType,
    contentType,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    readMode: permissions.readMode ?? 'all',
  };
};

export const expectItemShare = (
  shares: ItemShareState[],
  recipientShareCode: string,
  expected: { readMode: ShareReadMode; permissions?: Partial<SharePermissions> | null }
): void => {
  const share = shares.find((entry) => entry.sharedWithUserShareCode === recipientShareCode);
  expect(share, `item share for ${recipientShareCode}`).toBeDefined();
  expect(share!.readMode).toBe(expected.readMode);
  if (expected.permissions === null) {
    expect(share!.permissions).toBeNull();
    return;
  }
  if (!expected.permissions) return;
  expect(share!.permissions, `item permissions for ${recipientShareCode}`).toBeDefined();
  Object.entries(expected.permissions).forEach(([permission, enabled]) => {
    expect(share!.permissions![permission as keyof SharePermissions]).toBe(enabled);
  });
};

export const libraryMovieSeriesGrants = (permissions: SharePermissions): ShareGrant[] => [
  grant('library', 'movie', permissions),
  grant('library', 'series', permissions),
];

export const findGrantInPayload = (
  grants: ShareGrant[],
  listType: ShareListType,
  contentType: ShareContentType
): ShareGrant | undefined => grants.find((entry) => entry.listType === listType && entry.contentType === contentType);

export const expectGrant = (
  grants: ShareGrant[],
  listType: ShareListType,
  contentType: ShareContentType,
  expected: Partial<SharePermissions> & { readMode?: ShareGrantReadMode }
): void => {
  const match = findGrantInPayload(grants, listType, contentType);
  expect(match, `grant ${listType}/${contentType}`).toBeDefined();
  if (expected.canRead !== undefined) expect(match!.canRead).toBe(expected.canRead);
  if (expected.canCreate !== undefined) expect(match!.canCreate).toBe(expected.canCreate);
  if (expected.canUpdate !== undefined) expect(match!.canUpdate).toBe(expected.canUpdate);
  if (expected.canDelete !== undefined) expect(match!.canDelete).toBe(expected.canDelete);
  expect(match!.readMode).toBe(expected.readMode ?? 'all');
};

export const expectNoGrant = (grants: ShareGrant[], listType: ShareListType, contentType: ShareContentType): void => {
  expect(findGrantInPayload(grants, listType, contentType), `no grant ${listType}/${contentType}`).toBeUndefined();
};

export const createShareHelpers = (page: Page, api: ApiClient) => {
  const createdUsers: TestUser[] = [];

  const requestAs = async (
    user: Pick<TestUser, 'cookie'>,
    method: Parameters<ApiClient['request']>[0],
    url: string,
    body?: unknown
  ): Promise<APIResponse> => api.request(method, url, body, { Cookie: user.cookie });

  const createUser = async (label: string, prefix = 'share'): Promise<TestUser> => {
    const username = `${prefix}-${label}-${uniqueId()}`;
    const signUpResponse = await api.request('POST', '/api/v1/auth/sign-up', { username }, { Cookie: '' });
    const signUpBody = (await signUpResponse.json()) as ApiEnvelope<{ token: string }>;
    const token = signUpBody.data.token;
    const signInResponse = await api.request('POST', '/api/v1/auth/sign-in', { username, token }, { Cookie: '' });
    const user = { username, token, cookie: toCookieHeader(signInResponse) };
    const sharesResponse = await requestAs(user, 'GET', '/api/v1/users/me/shares');
    const sharesBody = (await sharesResponse.json()) as ApiEnvelope<{ userShareCode: string }>;
    const createdUser = { ...user, shareCode: sharesBody.data.userShareCode };
    createdUsers.push(createdUser);
    return createdUser;
  };

  const cleanupCreatedUsers = async (): Promise<void> => {
    for (const user of createdUsers.splice(0)) {
      await requestAs(user, 'DELETE', '/api/v1/users/me');
    }
  };

  const signInThroughUi = async (user: TestUser): Promise<void> => {
    await page.context().clearCookies();
    await page.addInitScript(resetPermissionStorage);
    await page.goto('/login/#/sign-in');
    await page.getByTestId('sign-in-username').locator('input').fill(user.username);
    await page.getByTestId('sign-in-token').locator('input').fill(user.token);
    await page.getByTestId('sign-in-submit').click();
    await expect(page).toHaveURL(/\/client\//);
  };

  const saveItemShares = async (
    owner: TestUser,
    item: { externalProvider: string; externalItemId: string; listType: ShareListType },
    selections: ItemShareSelection[]
  ): Promise<APIResponse> => {
    const response = await requestAs(
      owner,
      'PUT',
      `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}/shares?listType=${encodeURIComponent(item.listType)}`,
      { selections }
    );
    expect(response.status(), `save item shares for ${item.externalItemId}`).toBe(204);
    return response;
  };

  const getItemShares = async (
    owner: TestUser,
    item: { externalProvider: string; externalItemId: string; listType: ShareListType }
  ): Promise<APIResponse> =>
    requestAs(
      owner,
      'GET',
      `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}/shares?listType=${encodeURIComponent(item.listType)}`
    );

  const setupShare = async (
    grants: ShareGrant[],
    options: { ownerLabel?: string; sharedLabel?: string; prefix?: string } = {}
  ): Promise<{ owner: TestUser; sharedUser: TestUser }> => {
    const prefix = options.prefix ?? 'share';
    const owner = await createUser(options.ownerLabel ?? 'owner', prefix);
    const sharedUser = await createUser(options.sharedLabel ?? 'shared', prefix);
    const response = await requestAs(owner, 'POST', '/api/v1/users/me/shares', {
      sharedWithUserShareCode: sharedUser.shareCode,
      grants,
    });
    expect(response.status()).toBe(204);
    return { owner, sharedUser };
  };

  const seedOwnerItem = async (
    owner: TestUser,
    options: {
      title: string;
      contentType?: ShareContentType;
      listType?: ShareListType;
      externalId?: string;
      tags?: string[];
    }
  ): Promise<APIResponse> => {
    const contentType = options.contentType ?? 'movie';
    const listType = options.listType ?? (contentType === 'book' ? 'books' : 'library');
    const externalId = options.externalId ?? (contentType === 'book' ? '9780306406157' : uniqueImdbId());

    const body =
      contentType === 'book'
        ? {
            ...buildBooksItem(options.title, externalId),
            listType,
            tags: options.tags ?? [],
          }
        : {
            ...buildCollectionItem(options.title, contentType === 'series' ? 'series' : 'movie', externalId),
            listType,
            tags: options.tags ?? [],
          };

    const response = await requestAs(owner, 'POST', '/api/v1/collection-items', body);
    expect(response.status(), `seed ${listType}/${contentType} item`).toBe(200);
    return response;
  };

  return {
    createUser,
    cleanupCreatedUsers,
    signInThroughUi,
    requestAs,
    saveItemShares,
    getItemShares,
    setupShare,
    seedOwnerItem,
  };
};
