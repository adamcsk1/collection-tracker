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

const createdUsers: TestUser[] = [];
let imdbIdCounter = 0;

export const uniqueId = (): string => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

export const uniqueImdbId = (): string => {
  imdbIdCounter += 1;
  return `tt${Date.now()}${imdbIdCounter}`;
};

const getSetCookieHeaders = (headers: Cypress.Response<unknown>['headers']): string[] => {
  const setCookie = headers['set-cookie'];
  if (Array.isArray(setCookie)) return setCookie;
  if (typeof setCookie === 'string') return [setCookie];
  return [];
};

const toCookieHeader = (response: Cypress.Response<unknown>): string =>
  getSetCookieHeaders(response.headers)
    .map((cookie) => cookie.split(';')[0])
    .filter((cookie) => cookie.startsWith('CT.Token=') || cookie.startsWith('CT.RefreshToken='))
    .join('; ');

export const resetPermissionStorage = (browserWindow: Window): void => {
  browserWindow.sessionStorage.removeItem('CT.AppMode');
  browserWindow.sessionStorage.removeItem('CT.SettingLock');
  browserWindow.localStorage.setItem('CT.AppMode', 'full');
  browserWindow.localStorage.removeItem('CT.SettingLock');
};

export const requestAs = <ResponseBody = unknown>(
  user: Pick<TestUser, 'cookie'>,
  method: Cypress.HttpMethod,
  url: string,
  body?: Cypress.RequestBody
) =>
  cy.request<ResponseBody>({
    method,
    url,
    body,
    headers: { Cookie: user.cookie },
  });

export const createUser = (label: string, prefix = 'share'): Cypress.Chainable<TestUser> => {
  const username = `${prefix}-${label}-${uniqueId()}`;

  return cy
    .request<ApiEnvelope<{ token: string }>>({
      method: 'POST',
      url: '/api/v1/auth/sign-up',
      body: { username },
      headers: { Cookie: '' },
    })
    .then((signUpResponse) => {
      const token = signUpResponse.body.data.token;
      return cy
        .request({ method: 'POST', url: '/api/v1/auth/sign-in', body: { username, token }, headers: { Cookie: '' } })
        .then((signInResponse) => ({
          username,
          token,
          cookie: toCookieHeader(signInResponse),
        }));
    })
    .then((user) =>
      requestAs<ApiEnvelope<{ userShareCode: string }>>(user, 'GET', '/api/v1/users/me/shares').then(
        (sharesResponse) => {
          const createdUser = {
            ...user,
            shareCode: sharesResponse.body.data.userShareCode,
          };
          createdUsers.push(createdUser);
          return createdUser;
        }
      )
    );
};

export const cleanupCreatedUsers = (): void => {
  createdUsers.splice(0).forEach((user) => {
    requestAs(user, 'DELETE', '/api/v1/users/me');
  });
};

export const signInThroughUi = (user: TestUser): void => {
  cy.clearCookies({ log: false });
  cy.visit('/login/#/sign-in', {
    onBeforeLoad: resetPermissionStorage,
  });
  cy.getByTestId('sign-in-username').find('input').type(user.username);
  cy.getByTestId('sign-in-token').find('input').type(user.token, { delay: 0 });
  cy.getByTestId('sign-in-submit').should('be.enabled').click();
  cy.url().should('include', '/client/');
};

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

export const saveItemShares = (
  owner: TestUser,
  item: { externalProvider: string; externalItemId: string; listType: ShareListType },
  selections: ItemShareSelection[]
): Cypress.Chainable<Cypress.Response<unknown>> =>
  requestAs(
    owner,
    'PUT',
    `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}/shares?listType=${encodeURIComponent(item.listType)}`,
    { selections }
  ).then((response) => {
    expect(response.status, `save item shares for ${item.externalItemId}`).to.eq(204);
    return response;
  });

export const getItemShares = (
  owner: TestUser,
  item: { externalProvider: string; externalItemId: string; listType: ShareListType }
): Cypress.Chainable<Cypress.Response<ApiEnvelope<ItemShareState[]>>> =>
  requestAs<ApiEnvelope<ItemShareState[]>>(
    owner,
    'GET',
    `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}/shares?listType=${encodeURIComponent(item.listType)}`
  );

export const expectItemShare = (
  shares: ItemShareState[],
  recipientShareCode: string,
  expected: { readMode: ShareReadMode; permissions?: Partial<SharePermissions> | null }
): void => {
  const share = shares.find((entry) => entry.sharedWithUserShareCode === recipientShareCode);
  expect(share, `item share for ${recipientShareCode}`).to.exist;
  expect(share!.readMode).to.eq(expected.readMode);
  if (expected.permissions === null) {
    expect(share!.permissions).to.be.null;
    return;
  }
  if (!expected.permissions) return;
  expect(share!.permissions, `item permissions for ${recipientShareCode}`).to.exist;
  Object.entries(expected.permissions).forEach(([permission, enabled]) => {
    expect(share!.permissions![permission as keyof SharePermissions]).to.eq(enabled);
  });
};

export const libraryMovieSeriesGrants = (permissions: SharePermissions): ShareGrant[] => [
  grant('library', 'movie', permissions),
  grant('library', 'series', permissions),
];

export const setupShare = (
  grants: ShareGrant[],
  options: { ownerLabel?: string; sharedLabel?: string; prefix?: string } = {}
): Cypress.Chainable<{ owner: TestUser; sharedUser: TestUser }> => {
  const prefix = options.prefix ?? 'share';
  return createUser(options.ownerLabel ?? 'owner', prefix).then((owner) =>
    createUser(options.sharedLabel ?? 'shared', prefix).then((sharedUser) =>
      requestAs(owner, 'POST', '/api/v1/users/me/shares', {
        sharedWithUserShareCode: sharedUser.shareCode,
        grants,
      }).then((response) => {
        expect(response.status).to.eq(204);
        return { owner, sharedUser };
      })
    )
  );
};

export const seedOwnerItem = (
  owner: TestUser,
  options: {
    title: string;
    contentType?: ShareContentType;
    listType?: ShareListType;
    externalId?: string;
    tags?: string[];
  }
): Cypress.Chainable<Cypress.Response<unknown>> => {
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

  return requestAs(owner, 'POST', '/api/v1/collection-items', body).then((response) => {
    expect(response.status, `seed ${listType}/${contentType} item`).to.eq(200);
    return response;
  });
};

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
  expect(match, `grant ${listType}/${contentType}`).to.exist;
  if (expected.canRead !== undefined) expect(match!.canRead).to.eq(expected.canRead);
  if (expected.canCreate !== undefined) expect(match!.canCreate).to.eq(expected.canCreate);
  if (expected.canUpdate !== undefined) expect(match!.canUpdate).to.eq(expected.canUpdate);
  if (expected.canDelete !== undefined) expect(match!.canDelete).to.eq(expected.canDelete);
  expect(match!.readMode).to.eq(expected.readMode ?? 'all');
};

export const expectNoGrant = (grants: ShareGrant[], listType: ShareListType, contentType: ShareContentType): void => {
  expect(findGrantInPayload(grants, listType, contentType), `no grant ${listType}/${contentType}`).to.be.undefined;
};
