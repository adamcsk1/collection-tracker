import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { ApiClient, CollectionPageResponse, E2EFixtures } from './api-model';
import { COLLECTION_LIST_TYPES, DEFAULT_USER_SETTINGS } from './test-const';

export type { ApiClient } from './api-model';

let requestIpSuffix = 0;

const resetPermissionStorage = (): void => {
  window.sessionStorage.removeItem('CT.AppMode');
  window.sessionStorage.removeItem('CT.SettingLock');
  window.sessionStorage.removeItem('CT.SensitiveDataStorage');
  window.sessionStorage.removeItem('CT.ClearLocalStorageAfterLogout');
  window.sessionStorage.removeItem('CT.CollectionFeaturePreferences');
  window.localStorage.setItem('CT.AppMode', 'full');
  window.localStorage.removeItem('CT.SettingLock');
  window.localStorage.removeItem('CT.SensitiveDataStorage');
  window.localStorage.removeItem('CT.ClearLocalStorageAfterLogout');
  window.localStorage.removeItem('CT.CollectionListOrderPreferences');
  window.localStorage.removeItem('CT.CollectionFeaturePreferences');
};

const signInThroughUi = async (page: Page, username: string, token: string): Promise<void> => {
  await page.context().clearCookies();
  await page.goto('/login/#/sign-in');
  await page.evaluate(resetPermissionStorage);
  await page.reload();
  await page.getByTestId('sign-in-username').locator('input').fill(username);
  await page.getByTestId('sign-in-token').locator('input').fill(token);
  await page.getByTestId('sign-in-submit').click();
  await expect(page).toHaveURL(/\/client\//);
};

const createApiClient = (requestContext: APIRequestContext): ApiClient => {
  let authCookieHeader = '';

  return {
    request: async (method, url, body, headers = {}) => {
      requestIpSuffix += 1;
      const requestIp = `10.240.${Math.floor(requestIpSuffix / 250) % 250}.${(requestIpSuffix % 250) + 1}`;
      const response = await requestContext.fetch(url, {
        method,
        data: body,
        failOnStatusCode: true,
        headers: {
          'x-forwarded-for': requestIp,
          ...(authCookieHeader ? { Cookie: authCookieHeader } : {}),
          ...headers,
        },
      });

      if (url === '/api/v1/auth/sign-in') {
        authCookieHeader = response
          .headersArray()
          .filter((header) => header.name.toLowerCase() === 'set-cookie')
          .map((header) => header.value.split(';')[0])
          .filter((cookie) => cookie.startsWith('CT.Token=') || cookie.startsWith('CT.RefreshToken='))
          .join('; ');
      }

      return response;
    },
    clearAuth: () => {
      authCookieHeader = '';
    },
  };
};

const clearCollectionLists = async (api: ApiClient): Promise<void> => {
  for (const listType of COLLECTION_LIST_TYPES) {
    const items: CollectionPageResponse['data'] = [];
    let cursor: string | undefined;
    do {
      const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const response = await api.request(
        'GET',
        `/api/v1/collection-items?limit=100&listType=${encodeURIComponent(listType)}${cursorQuery}`
      );
      expect(response.status()).toBe(200);
      const page = (await response.json()) as CollectionPageResponse;
      items.push(...page.data);
      if (page.page.hasMore) expect(page.page.nextCursor).toEqual(expect.any(String));
      cursor = page.page.hasMore ? (page.page.nextCursor ?? undefined) : undefined;
    } while (cursor);

    for (const item of items) {
      const itemListType = item.listType || listType;
      const deleteResponse = await api.request(
        'DELETE',
        `/api/v1/collection-items/${encodeURIComponent(item.externalProvider)}/${encodeURIComponent(item.externalItemId)}?hash=${encodeURIComponent(item.hash)}&listType=${encodeURIComponent(itemListType)}`
      );
      expect(deleteResponse.status()).toBe(204);
    }

    const remainingResponse = await api.request('GET', `/api/v1/collection-items?limit=100&listType=${listType}`);
    const remainingPage = (await remainingResponse.json()) as CollectionPageResponse;
    expect(remainingPage.data, `${listType} cleanup`).toEqual([]);
  }
};

export const test = base.extend<E2EFixtures>({
  api: async ({ request }, use) => {
    await use(createApiClient(request));
  },
  autoLogin: async ({ api, page }, use) => {
    await use(async () => {
      const username = 'playwright';
      const token =
        'few deal cave wagon only forget frame food exchange swung steam by stick proud produce give naturally accept combine breath handsome freedom firm market is helpful special matter powder machine known lovely quickly require mission grandfather larger next stick lay best opposite good apple diameter pitch mysterious range hole whom raw country studying structure serious cost glad series black detail quickly happy arrive stand harbor middle affect around sand related told suddenly even leather deal design get shape noise space six calm root recall against shelf cookies enemy birth count even hungry image liquid rhythm mark express where color contain further end easy slightly observe barn something slide factor spell arrange piano paid still hill those parent health baby along upward upper spin circle firm fifth completely drop nothing detail difficult combine putting';
      api.clearAuth();
      const response = await api.request('POST', '/api/v1/auth/sign-in', { username, token });
      expect(response.status()).toBe(204);
      await clearCollectionLists(api);
      expect((await api.request('POST', '/api/v1/users/me/tags', [])).status()).toBe(200);
      expect((await api.request('POST', '/api/v1/users/me/settings', DEFAULT_USER_SETTINGS)).status()).toBe(200);
      await signInThroughUi(page, username, token);
      await page.goto('/client/#/collection/library');
    });
  },
  autoLoginWithNewUser: async ({ api, page }, use) => {
    await use(async () => {
      const username = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      api.clearAuth();
      const signUpResponse = await api.request('POST', '/api/v1/auth/sign-up', { username });
      expect(signUpResponse.status()).toBe(200);
      const signUpBody = (await signUpResponse.json()) as { data: { token: string } };
      const token = signUpBody.data.token;
      expect((await api.request('POST', '/api/v1/auth/sign-in', { username, token })).status()).toBe(204);
      await signInThroughUi(page, username, token);
      await page.goto('/client/#/collection/library');
    });
  },
});

export { expect };
