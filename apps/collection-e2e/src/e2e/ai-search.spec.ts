import type { Page } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { expect, test, type ApiClient } from '../support/test';

let collectionPage: ReturnType<typeof createCollectionPage>;

test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
});

const stubAiAvailability = async (page: Page) => {
  await page.route('**/api/v1/ai/availability', async (route) => {
    await route.fulfill({ status: 200, json: { data: { aiAvailable: true } } });
  });
};

const stubAiMatches = async (page: Page, matchedIds: string[]) => {
  await page.route('**/api/v1/ai/matches', async (route) => {
    await route.fulfill({ status: 200, json: { data: { matchedIds } } });
  });
};

const waitForAiAvailability = async (page: Page, autoLogin: () => Promise<void>) => {
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'GET' && response.url().includes('/api/v1/ai/availability')
  );
  await autoLogin();
  await responsePromise;
};

/** Seeds items and reloads the collection page so the store is populated. */
const seedAndVisit = async (api: ApiClient, items: ReturnType<typeof buildCollectionItem>[]) => {
  for (const item of items) {
    await api.request('POST', '/api/v1/collection-items', item);
  }
  await collectionPage.visit();
};

test.describe('AI search - input interaction', () => {
  test.beforeEach(async ({ page, autoLogin }) => {
    await stubAiAvailability(page);
    await waitForAiAvailability(page, autoLogin);
  });

  test('closes the dialog when send is clicked', async ({ page }) => {
    await stubAiMatches(page, []);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/ai/matches')
    );
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('any prompt');
    await collectionPage.getAiSearchSendButton().click();
    await responsePromise;
    await expect(collectionPage.getAiSearchSendButton()).toHaveCount(0);
  });
});

test.describe('AI search - filtering', () => {
  const movieA = buildCollectionItem('Sci-Fi Alpha', 'movie', 'tt1000001');
  const movieB = buildCollectionItem('Drama Beta', 'movie', 'tt1000002');
  const movieC = buildCollectionItem('Action Gamma', 'movie', 'tt1000003');

  test.beforeEach(async ({ page, autoLogin, api }) => {
    await stubAiAvailability(page);
    await waitForAiAvailability(page, autoLogin);
    await seedAndVisit(api, [movieA, movieB, movieC]);
  });

  test('filters the list to only matched items when AI returns IDs', async ({ page }) => {
    await stubAiMatches(page, ['tt1000001']);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('sci-fi movies');
    const aiResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/ai/matches')
    );
    const matchedItemsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/api/v1/collection-items/matches')
    );
    await collectionPage.getAiSearchSendButton().click();

    await aiResponsePromise;
    await matchedItemsResponsePromise;
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItems().first()).toContainText('Sci-Fi Alpha');
  });

  test('shows the empty state when AI returns no matched IDs', async ({ page }) => {
    await stubAiMatches(page, []);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('something that matches nothing');
    const aiResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/ai/matches')
    );
    const matchedItemsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/api/v1/collection-items/matches')
    );
    await collectionPage.getAiSearchSendButton().click();

    await aiResponsePromise;
    await matchedItemsResponsePromise;
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('shows all items when the prompt is empty (no search sent)', async () => {
    await expect(collectionPage.getAllItems()).toHaveCount(3);
  });

  test('sends the prompt text and library listType to the AI proxy endpoint', async ({ page }) => {
    await stubAiMatches(page, []);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('show me action films');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/ai/matches')
    );
    await collectionPage.getAiSearchSendButton().click();

    const response = await responsePromise;
    expect(response.request().postDataJSON()).toEqual({ prompt: 'show me action films', listType: 'library' });
  });
});

test.describe('AI search - watchlist list', () => {
  const movieA = buildCollectionItem('Sci-Fi Alpha', 'movie', 'tt2000001');

  test.beforeEach(async ({ page, autoLogin, api }) => {
    await stubAiAvailability(page);
    await waitForAiAvailability(page, autoLogin);
    await api.request('POST', '/api/v1/collection-items', { ...movieA, listType: 'up-next' });
    await collectionPage.visitUpNext();
  });

  test('sends watchlist listType', async ({ page }) => {
    await stubAiMatches(page, ['tt2000001']);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('sci-fi');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/ai/matches')
    );
    await collectionPage.getAiSearchSendButton().click();

    const response = await responsePromise;
    expect(response.request().postDataJSON()).toEqual({ prompt: 'sci-fi', listType: 'up-next' });
  });
});
