/// <reference types="cypress" />

export {};

let authCookieHeader = '';
let requestIpSuffix = 1;

type AuthCookie = {
  name: string;
  value: string;
};

const collectionListTypes = ['library', 'watch-later', 'wishlist', 'series-tracker', 'movie-tracker'] as const;

const getSetCookieHeaders = (headers: Cypress.Response<unknown>['headers']): string[] => {
  const setCookie = headers['set-cookie'];
  if (Array.isArray(setCookie)) return setCookie;
  if (typeof setCookie === 'string') return [setCookie];
  return [];
};

const parseAuthCookie = (cookie: string): AuthCookie | null => {
  const cookieValue = cookie.split(';')[0];
  const separatorIndex = cookieValue.indexOf('=');
  if (separatorIndex === -1) return null;

  const name = cookieValue.slice(0, separatorIndex);
  if (name !== 'CT.Token' && name !== 'CT.RefreshToken') return null;

  return {
    name,
    value: cookieValue.slice(separatorIndex + 1),
  };
};

const storeAuthCookies = (response: Cypress.Response<unknown>): void => {
  const authCookies = getSetCookieHeaders(response.headers)
    .map(parseAuthCookie)
    .filter((cookie): cookie is AuthCookie => cookie !== null);

  authCookieHeader = authCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
};

const resetPermissionStorage = (win: Window): void => {
  win.sessionStorage.removeItem('CT.AppMode');
  win.sessionStorage.removeItem('CT.SettingLock');
  win.sessionStorage.removeItem('CT.SensitiveDataStorage');
  win.sessionStorage.removeItem('CT.ClearLocalStorageAfterLogout');
  win.localStorage.setItem('CT.AppMode', 'full');
  win.localStorage.removeItem('CT.SettingLock');
  win.localStorage.removeItem('CT.SensitiveDataStorage');
  win.localStorage.removeItem('CT.ClearLocalStorageAfterLogout');
  win.localStorage.removeItem('CT.CollectionListOrderPreferences');
};

const signInThroughUi = (username: string, token: string): void => {
  cy.clearCookies({ log: false });
  cy.visit('/login/#/sign-in', {
    onBeforeLoad: resetPermissionStorage,
  });
  cy.getByTestId('sign-in-username').find('input').type(username);
  cy.getByTestId('sign-in-token').find('input').type(token, { delay: 0 });
  cy.getByTestId('sign-in-submit').click();
  cy.url().should('include', '/client/');
};

const toRequestOptions = (requestArgs: unknown[]): Partial<Cypress.RequestOptions> | undefined => {
  const [firstArg, secondArg, thirdArg] = requestArgs;

  if (typeof firstArg === 'object' && firstArg !== null) return firstArg as Partial<Cypress.RequestOptions>;
  if (typeof firstArg === 'string' && typeof secondArg === 'string') {
    return { method: firstArg, url: secondArg, body: thirdArg as Cypress.RequestBody };
  }
  if (typeof firstArg === 'string') return { url: firstArg };

  return undefined;
};

Cypress.Commands.overwrite('request', (originalFn, ...args) => {
  const options = toRequestOptions(args);
  if (!options) return originalFn(...args);

  requestIpSuffix += 1;
  const e2eRequestIp = `10.240.${Math.floor(requestIpSuffix / 250) % 250}.${(requestIpSuffix % 250) + 1}`;

  if (!authCookieHeader) {
    return originalFn({
      ...options,
      headers: {
        'x-forwarded-for': e2eRequestIp,
        ...options.headers,
      },
    });
  }

  return originalFn({
    ...options,
    headers: {
      'x-forwarded-for': e2eRequestIp,
      Cookie: authCookieHeader,
      ...options.headers,
    },
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      getByTestId(testId: string, options?: Partial<Timeoutable>): Chainable<JQuery<HTMLElement>>;
      /**
       * Signs in with the pre-created cypress user and wipes its collection.
       * Fast - no sign-up round-trip. Use this for the majority of tests.
       */
      autoLogin(): Chainable<void>;
      /**
       * Signs up a fresh unique user and signs in.
       * Use when the test must not share user state with any other test.
       */
      autoLoginWithNewUser(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('getByTestId', (testId: string, options?: Partial<Cypress.Timeoutable>) => {
  return cy.get(`[data-test-id="${testId}"]`, options);
});

Cypress.Commands.add('autoLogin', () => {
  const username = 'cypress';
  const token =
    'few deal cave wagon only forget frame food exchange swung steam by stick proud produce give naturally accept combine breath handsome freedom firm market is helpful special matter powder machine known lovely quickly require mission grandfather larger next stick lay best opposite good apple diameter pitch mysterious range hole whom raw country studying structure serious cost glad series black detail quickly happy arrive stand harbor middle affect around sand related told suddenly even leather deal design get shape noise space six calm root recall against shelf cookies enemy birth count even hungry image liquid rhythm mark express where color contain further end easy slightly observe barn something slide factor spell arrange piano paid still hill those parent health baby along upward upper spin circle firm fifth completely drop nothing detail difficult combine putting';

  authCookieHeader = '';

  cy.request('POST', '/api/v1/sign-in', { username, token }).then(storeAuthCookies);

  collectionListTypes.forEach((listType) => {
    const listItemsUrl = `/api/v1/items?limit=1000&offset=0&listType=${encodeURIComponent(listType)}`;
    cy.request('GET', listItemsUrl).then((response) => {
      const items = (response.body as { items: Array<{ IMDbId: string; hash: string }> }).items;
      items.forEach((item) => {
        const deleteUrl = `/api/v1/delete/${encodeURIComponent(item.IMDbId)}?hash=${encodeURIComponent(
          item.hash
        )}&listType=${encodeURIComponent(listType)}`;
        cy.request('DELETE', deleteUrl);
      });
    });
  });

  cy.request('POST', '/api/v1/tag-management', []);

  signInThroughUi(username, token);

  cy.visit('/client/#/collection/library', {
    onBeforeLoad: resetPermissionStorage,
  });
});

Cypress.Commands.add('autoLoginWithNewUser', () => {
  const username = `cy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  authCookieHeader = '';

  cy.request('POST', '/api/v1/sign-up', { username })
    .its('body')
    .then((body) => {
      const { token } = body as { token: string };
      cy.request('POST', '/api/v1/sign-in', { username, token }).then(storeAuthCookies);
      signInThroughUi(username, token);
    })
    .then(() => {
      cy.visit('/client/#/collection/library', {
        onBeforeLoad: resetPermissionStorage,
      });
    });
});
