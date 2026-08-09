import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';

export type ShareListType = 'library' | 'books' | 'wishlist' | 'up-next' | 'tracking';
export type ShareContentType = 'movie' | 'series' | 'book';
export type SharePermissionKey = 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete';

export interface ShareGrant {
  listType: ShareListType;
  contentType: ShareContentType;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface SharePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface TestUser {
  username: string;
  token: string;
  cookie: string;
  shareCode: string;
}

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
    .request<{ token: string }>({
      method: 'POST',
      url: '/api/v1/sign-up',
      body: { username },
      headers: { Cookie: '' },
    })
    .then((signUpResponse) => {
      const token = signUpResponse.body.token;
      return cy
        .request({ method: 'POST', url: '/api/v1/sign-in', body: { username, token }, headers: { Cookie: '' } })
        .then((signInResponse) => ({
          username,
          token,
          cookie: toCookieHeader(signInResponse),
        }));
    })
    .then((user) =>
      requestAs<{ userShareCode: string }>(user, 'GET', '/api/v1/user/shares').then((sharesResponse) => {
        const createdUser = {
          ...user,
          shareCode: sharesResponse.body.userShareCode,
        };
        createdUsers.push(createdUser);
        return createdUser;
      })
    );
};

export const cleanupCreatedUsers = (): void => {
  createdUsers.splice(0).forEach((user) => {
    requestAs(user, 'DELETE', '/api/v1/user');
  });
};

export const signInThroughUi = (user: TestUser): void => {
  cy.clearCookies({ log: false });
  cy.visit('/login/#/sign-in', {
    onBeforeLoad: resetPermissionStorage,
  });
  cy.getByTestId('sign-in-username').find('input').type(user.username);
  cy.getByTestId('sign-in-token').find('input').type(user.token, { delay: 0 });
  cy.getByTestId('sign-in-submit').click();
  cy.url().should('include', '/client/');
};

export const grant = (
  listType: ShareListType,
  contentType: ShareContentType,
  permissions: Partial<SharePermissions> = { canRead: true }
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
  };
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
      requestAs(owner, 'POST', '/api/v1/user/shares', {
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
  const externalId =
    options.externalId ?? (contentType === 'book' ? '9780306406157' : uniqueImdbId());

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

  return requestAs(owner, 'POST', '/api/v1/create', body).then((response) => {
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
  expected: Partial<SharePermissions>
): void => {
  const match = findGrantInPayload(grants, listType, contentType);
  expect(match, `grant ${listType}/${contentType}`).to.exist;
  if (expected.canRead !== undefined) expect(match!.canRead).to.eq(expected.canRead);
  if (expected.canCreate !== undefined) expect(match!.canCreate).to.eq(expected.canCreate);
  if (expected.canUpdate !== undefined) expect(match!.canUpdate).to.eq(expected.canUpdate);
  if (expected.canDelete !== undefined) expect(match!.canDelete).to.eq(expected.canDelete);
};

export const expectNoGrant = (
  grants: ShareGrant[],
  listType: ShareListType,
  contentType: ShareContentType
): void => {
  expect(findGrantInPayload(grants, listType, contentType), `no grant ${listType}/${contentType}`).to.be.undefined;
};
