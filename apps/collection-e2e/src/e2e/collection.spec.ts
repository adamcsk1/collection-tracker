import type { Page } from '@playwright/test';
import { buildCollectionItem, buildCollectionItems } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { expect, test, type ApiClient } from '../support/test';
import { fillAutocomplete } from '../support/input-util';

let collectionPage: ReturnType<typeof createCollectionPage>;
let commonPage: ReturnType<typeof createCommonPage>;
test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
  commonPage = createCommonPage(page);
  page.on('dialog', (dialog) => dialog.accept());
});

const seedItems = async (api: ApiClient, items: ReturnType<typeof buildCollectionItem>[]) => {
  for (const item of items) await api.request('POST', '/api/v1/collection-items', item);
};

const expectVisibleTitles = async (titles: string[]) => {
  await expect(collectionPage.getListItems()).toHaveText(titles);
};

const itemsResponse = (page: Page, expectedUrlParts: string[] = []) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === '/api/v1/collection-items' &&
      expectedUrlParts.every((part) => response.url().includes(part))
  );

const saveManualItem = async (
  page: Page,
  title: string,
  imdbId: string,
  contentType: 'movie' | 'series',
  listType: 'library' | 'up-next' | 'wishlist' | 'tracking'
) => {
  await collectionPage.getNewItemManualModeButton().click();
  await collectionPage.getNewItemManualContentTypeSelect().selectOption(contentType);
  await collectionPage.getNewItemManualTitleInput().fill(title);
  await collectionPage.getNewItemManualImdbIdInput().fill(imdbId);
  await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/collection-items'
  );
  await collectionPage.getNewItemSaveAndCloseButton().click();
  const response = await responsePromise;
  const body = response.request().postDataJSON();
  expect(body).toMatchObject({
    title,
    IMDbId: imdbId,
    externalProvider: 'omdb',
    externalItemId: imdbId,
    contentType,
    favorite: false,
  });
  if (listType !== 'library') expect(body.listType).toBe(listType);
  expect(body.externalIds).toEqual([{ source: 'imdb', id: imdbId }]);
  expect(response.status()).toBe(200);
};

const reloadAndExpectPersistedTitle = async (page: Page, title: string, expectedItemCount = 1) => {
  const responsePromise = itemsResponse(page);
  await page.reload();
  await responsePromise;
  await expect(collectionPage.getListItems()).toHaveCount(expectedItemCount);
  await expect(collectionPage.getListItems().filter({ hasText: title })).toHaveCount(1);
};

const closeOpenDialogThenClickFirstItem = async (page: Page) => {
  if (await page.getByTestId('dialog-overlay').count()) await collectionPage.closeDialogByOverlay();
  await collectionPage.getListItemImages().first().click();
};

const showOrderControls = async () => {
  await expect(
    collectionPage.getShowFunctionsButton().or(collectionPage.getOrderByCreatedAtButton()).first()
  ).toBeVisible();
  if (await collectionPage.getShowFunctionsButton().count()) await collectionPage.getShowFunctionsButton().click();
  await expect(collectionPage.getOrderByCreatedAtButton()).toBeVisible();
  await expect(collectionPage.getOrderByAlphabetButton()).toBeVisible();
  await expect(collectionPage.getOrderDirectionDescButton()).toBeVisible();
  await expect(collectionPage.getOrderDirectionAscButton()).toBeVisible();
};

test.describe('Collection — empty state', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });
  test('shows the empty state message when collection has no items', async ({ page }) => {
    const responsePromise = itemsResponse(page);
    await page.reload();
    await responsePromise;
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
  test('shows the "Add first item" link in the empty state', async () => {
    await expect(collectionPage.getAddFirstItemLink()).toBeVisible();
  });
  test('has a visible search input', async () => {
    await expect(await collectionPage.getSearchInput()).toBeVisible();
  });
});

test.describe('Collection — add a new element', () => {
  const newTitle = 'Test Movie Alpha';
  test.beforeEach(async ({ page, autoLogin }) => {
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbSearchResult(newTitle) } })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbItem(newTitle) } })
    );
    await autoLogin();
  });

  test('opens the new-item dialog via float buttons', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await expect(collectionPage.getNewItemSearchInput()).toBeVisible();
    await expect(collectionPage.getNewItemActionButtons()).toHaveCount(3);
    for (const button of await collectionPage.getNewItemActionButtons().all()) {
      await expect(button).toHaveClass(/button-icon/);
      await expect(button).toHaveClass(/button-reveal-label/);
      await expect(button).toHaveAttribute('aria-label', /\S/);
      await expect(button).toHaveAttribute('title', /\S/);
      await expect(
        button.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " dialog-footer ")]')
      ).toHaveCount(1);
    }
  });

  test('searches external metadata, saves the item, and it appears in the list', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemSaveButton().click();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItems().first()).toContainText(newTitle);
  });

  test('searches external metadata when enter is pressed in the new-item search', async ({ page }) => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    const responsePromise = page.waitForResponse('**/api/v1/external-metadata/search*');
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await collectionPage.getNewItemSearchInput().press('Enter');
    await responsePromise;
    await expect(collectionPage.getNewItemSearchInput()).toHaveValue(newTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
  });

  test('saves a new item and keeps the dialog open for another item', async ({ page }) => {
    const firstTitle = 'Save And New Movie One';
    const secondTitle = 'Save And New Movie Two';
    await page.route(
      '**/api/v1/external-metadata/search*',
      (route) => route.fulfill({ status: 200, json: { data: buildOmdbSearchResult(firstTitle, 'tt5000001') } }),
      { times: 1 }
    );
    await page.route(
      '**/api/v1/external-metadata/items*',
      (route) => route.fulfill({ status: 200, json: { data: buildOmdbItem(firstTitle, 'tt5000001') } }),
      { times: 1 }
    );
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(firstTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemSaveAndNewButton().click();
    await collectionPage.getNewItemSearchInput().scrollIntoViewIfNeeded();
    await expect(collectionPage.getNewItemSearchInput()).toBeVisible();
    await expect(collectionPage.getNewItemSearchInput()).toHaveValue('');
    await expect(collectionPage.getListItems().filter({ hasText: firstTitle })).toHaveCount(1);
    await page.route(
      '**/api/v1/external-metadata/search*',
      (route) => route.fulfill({ status: 200, json: { data: buildOmdbSearchResult(secondTitle, 'tt5000002') } }),
      { times: 1 }
    );
    await page.route(
      '**/api/v1/external-metadata/items*',
      (route) => route.fulfill({ status: 200, json: { data: buildOmdbItem(secondTitle, 'tt5000002') } }),
      { times: 1 }
    );
    await collectionPage.getNewItemSearchInput().fill(secondTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await expect(collectionPage.getNewItemSearch()).toHaveCount(0);
    await expect(collectionPage.getListItems().filter({ hasText: firstTitle })).toHaveCount(1);
    await expect(collectionPage.getListItems().filter({ hasText: secondTitle })).toHaveCount(1);
  });

  test('saves a new item with the watched tag', async ({ page }) => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await page.getByTestId('new-item-finished').locator('input[type="checkbox"]').check();
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await collectionPage.getListItems().filter({ hasText: newTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogMarkUnfinishedButton()).toBeVisible();
  });

  test('saves a new item with a user rate', async ({ api }) => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemUserRateInput().fill('8.7');
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await expect(collectionPage.getNewItemSearch()).toHaveCount(0);
    await collectionPage.setListPreferredRatingToUser(api);
    await collectionPage.visit();
    await expect(collectionPage.getListItemUserRates()).toContainText('8.7');
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogUserRateChip()).toContainText('8.7');
  });

  test('keeps save disabled for an invalid new item user rate', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemUserRateInput().fill('10.1');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeDisabled();
  });

  test('adds a new item manually and persists it after reload', async ({ page }) => {
    const manualTitle = 'Manual Test Movie';
    const manualImdbId = 'tt9990001';
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await expect(collectionPage.getNewItemManualHint()).toBeVisible();
    await collectionPage.getNewItemManualTitleInput().fill(manualTitle);
    await collectionPage.getNewItemManualImdbIdInput().fill(manualImdbId);
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/collection-items'
    );
    await collectionPage.getNewItemSaveAndCloseButton().click();
    const response = await responsePromise;
    expect(response.request().postDataJSON()).toMatchObject({
      title: manualTitle,
      IMDbId: manualImdbId,
      externalProvider: 'omdb',
      externalItemId: manualImdbId,
      contentType: 'movie',
      favorite: false,
    });
    expect(response.request().postDataJSON().externalIds).toEqual([{ source: 'imdb', id: manualImdbId }]);
    expect(response.status()).toBe(200);
    expect((await response.json()).data.item).toMatchObject({
      title: manualTitle,
      IMDbId: manualImdbId,
      externalProvider: 'omdb',
      externalItemId: manualImdbId,
      contentType: 'movie',
    });
    await reloadAndExpectPersistedTitle(page, manualTitle);
    await expectVisibleTitles([manualTitle]);
  });

  test('keeps manual save disabled for invalid required fields', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemManualTitleInput().fill('Manual Title');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeDisabled();
    await collectionPage.getNewItemManualImdbIdInput().fill('not-an-imdb-id');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeDisabled();
  });

  test('keeps the manual image preview below the manual entry hint', async ({ page }) => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemManualImageInput().fill('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(collectionPage.getNewItemManualHintAndPreview()).toHaveCount(2);
      await expect
        .poll(() =>
          collectionPage
            .getNewItemManualHintAndPreview()
            .evaluateAll(
              (elements) => elements[1]!.getBoundingClientRect().top - elements[0]!.getBoundingClientRect().bottom
            )
        )
        .toBeGreaterThan(0);
    }
  });

  test('switches back to search mode preserving the search input', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemSearchInput().fill(newTitle);
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemSearchModeButton().click();
    await expect(collectionPage.getNewItemSearchInput()).toHaveValue(newTitle);
  });

  test('switches entry modes with accessible keyboard tabs', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await expect(collectionPage.getNewItemModeTabs()).toHaveAttribute('aria-label', 'Item entry method');
    await expect(collectionPage.getNewItemSearchModeButton()).toHaveAttribute('aria-selected', 'true');
    await collectionPage.getNewItemSearchModeButton().focus();
    await collectionPage.getNewItemSearchModeButton().press('ArrowRight');
    await expect(collectionPage.getNewItemManualModeButton()).toBeFocused();
    await expect(collectionPage.getNewItemManualModeButton()).toHaveAttribute('aria-selected', 'true');
    await expect(collectionPage.getNewItemSearchPanel()).toBeHidden();
    await expect(collectionPage.getNewItemManualPanel()).toBeVisible();
    await collectionPage.getNewItemManualModeButton().press('ArrowLeft');
    await expect(collectionPage.getNewItemSearchModeButton()).toBeFocused();
    await expect(collectionPage.getNewItemSearchModeButton()).toHaveAttribute('aria-selected', 'true');
    await expect(collectionPage.getNewItemSearchPanel()).toBeVisible();
    await expect(collectionPage.getNewItemManualPanel()).toBeHidden();
  });
});

test.describe('Collection — delete an element', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await seedItems(api, [buildCollectionItem('Movie To Delete')]);
    await collectionPage.visit();
  });
  test('deletes the item and the empty state becomes visible', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogDeleteButton().click();
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
});

test.describe('Collection — cursor pagination', () => {
  const titles = Array.from({ length: 55 }, (_, index) => `Cursor Test Movie ${String(index + 1).padStart(2, '0')}`);
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });
  test('continues the real cursor page when the collection list reaches the bottom', async ({ page, api }) => {
    await seedItems(api, buildCollectionItems(titles));
    const responsePromise = itemsResponse(page);
    await collectionPage.visit();
    const response = await responsePromise;
    const body = await response.json();
    expect(response.status()).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['data', 'page']);
    expect(body.data).toHaveLength(50);
    expect(Object.keys(body.page).sort()).toEqual(['hasMore', 'limit', 'nextCursor']);
    expect(body.page).toMatchObject({ limit: 50, hasMore: true });
    expect(body.page.nextCursor).toEqual(expect.any(String));
    expect(body.page.nextCursor).not.toBe('');
    await expect(collectionPage.getListItems()).toHaveCount(50);
    const nextResponsePromise = itemsResponse(page, ['cursor=']);
    await collectionPage.getList().evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll'));
    });
    const nextResponse = await nextResponsePromise;
    expect(new URL(nextResponse.url()).searchParams.get('cursor')).toBe(body.page.nextCursor);
    expect(nextResponse.status()).toBe(200);
    const nextBody = await nextResponse.json();
    expect(nextBody.data).toHaveLength(5);
    expect(nextBody.page).toEqual({ limit: 50, hasMore: false, nextCursor: null });
    await expect(collectionPage.getListItems()).toHaveCount(55);
    const renderedTitles = (await collectionPage.getListItems().allTextContents()).map((title) => title.trim());
    expect(new Set(renderedTitles).size).toBe(55);
    expect(renderedTitles.sort()).toEqual([...titles].sort());
  });
});

test.describe('Collection — random pick', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await seedItems(api, buildCollectionItems(['Random Pick Movie A', 'Random Pick Movie B', 'Random Pick Movie C']));
    await collectionPage.visit();
  });
  test('random pick button opens an item dialog', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await expect(collectionPage.getRandomPickButton()).toBeEnabled();
    await collectionPage.getRandomPickButton().click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogEditButton()).toBeVisible();
  });
});

test.describe('Collection — scroll to top', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await seedItems(api, buildCollectionItems(Array.from({ length: 60 }, (_, index) => `Top Test Movie ${index + 1}`)));
    await collectionPage.visit();
  });
  test('scroll-to-top button appears after scrolling and returns to top', async () => {
    await expect(collectionPage.getListItems()).toHaveCount(50);
    await collectionPage.getList().evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll'));
    });
    await expect.poll(() => collectionPage.getList().evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(collectionPage.getScrollToTopButton()).toBeVisible();
    await collectionPage.getScrollToTopButton().click();
    await expect.poll(() => collectionPage.getList().evaluate((element) => element.scrollTop)).toBe(0);
  });
});

test.describe('Collection — fuzzy search', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await seedItems(
      api,
      buildCollectionItems(['Interstellar', 'Inception', 'The Dark Knight', 'Avengers Endgame', 'Parasite'])
    );
    await collectionPage.visit();
  });
  test('filters the list based on search input', async () => {
    await expect(collectionPage.getAllItems()).toHaveCount(5);
    await fillAutocomplete(await collectionPage.getSearchInput(), 'Interstellar');
    await expectVisibleTitles(['Interstellar']);
  });
  test('shows all items again when search is cleared', async () => {
    await fillAutocomplete(await collectionPage.getSearchInput(), 'Interstellar');
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await fillAutocomplete(await collectionPage.getSearchInput(), '');
    await expect(collectionPage.getAllItems()).toHaveCount(5);
  });
  test('uses partial title search to find the item', async () => {
    await fillAutocomplete(await collectionPage.getSearchInput(), 'stellar');
    await expect(collectionPage.getListItems().first()).toContainText('Interstellar');
  });
});

test.describe('Collection — standard search in secondary lists', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    for (const [index, title] of [
      'Wishlist Search Alpha',
      'Wishlist Search Beta',
      'Watch Later Search Alpha',
      'Watch Later Search Beta',
      'Series Tracker Search Alpha',
      'Series Tracker Search Beta',
      'Movie Tracker Search Alpha',
      'Movie Tracker Search Beta',
    ].entries()) {
      await api.request('POST', '/api/v1/collection-items', {
        ...buildCollectionItem(title, index === 4 || index === 5 ? 'series' : 'movie', `tt830000${index + 1}`),
        listType: index < 2 ? 'wishlist' : index < 4 ? 'up-next' : 'tracking',
      });
    }
  });
  test('filters wishlist items and requests wishlist-scoped suggestions', async ({ page }) => {
    await commonPage.openMenu();
    await commonPage.getNavWishlistLink().click();
    const input = await collectionPage.getWishlistSearchInput();
    await expect(input).toBeVisible();
    const responsePromise = page.waitForResponse('**/api/v1/collection-items/suggestions*');
    await fillAutocomplete(input, 'Alpha');
    expect((await responsePromise).url()).toContain('listType=wishlist');
    await expectVisibleTitles(['Wishlist Search Alpha']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Wishlist Search Beta' })).toHaveCount(0);
  });
  test('filters watch later items', async () => {
    await commonPage.openMenu();
    await commonPage.getNavUpNextLink().click();
    const input = await collectionPage.getUpNextSearchInput();
    await expect(input).toBeVisible();
    await fillAutocomplete(input, 'Alpha');
    await expectVisibleTitles(['Watch Later Search Alpha']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Later Search Beta' })).toHaveCount(0);
  });
  test('filters tracking items', async () => {
    await commonPage.openMenu();
    await commonPage.getNavTrackingLink().click();
    const input = await collectionPage.getTrackingSearchInput();
    await expect(input).toBeVisible();
    await fillAutocomplete(input, 'Series Tracker Search Alpha');
    await expectVisibleTitles(['Series Tracker Search Alpha']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Series Tracker Search Beta' })).toHaveCount(0);
    await expect(collectionPage.getListItems().filter({ hasText: 'Movie Tracker Search Alpha' })).toHaveCount(0);
  });
});

test.describe('Collection — order controls', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('orders library items and persists the selected order after refresh', async ({ page, api }) => {
    await seedItems(api, [
      buildCollectionItem('Order Alpha', 'movie', 'tt8400001'),
      buildCollectionItem('Order Charlie', 'movie', 'tt8400002'),
      buildCollectionItem('Order Bravo', 'movie', 'tt8400003'),
    ]);
    const initialResponsePromise = itemsResponse(page);
    await collectionPage.visit();
    await initialResponsePromise;
    await expectVisibleTitles(['Order Bravo', 'Order Charlie', 'Order Alpha']);
    await collectionPage.getShowFunctionsButton().click();
    const ascendingResponsePromise = itemsResponse(page, ['orderDirection=asc']);
    await collectionPage.getOrderDirectionAscButton().click();
    await ascendingResponsePromise;
    await expect(page).toHaveURL(/orderDirection=asc/);
    await expect(page).not.toHaveURL(/orderBy=/);
    await expectVisibleTitles(['Order Alpha', 'Order Charlie', 'Order Bravo']);
    await collectionPage.getShowFunctionsButton().click();
    const alphabetResponsePromise = itemsResponse(page, ['orderBy=alphabet']);
    await collectionPage.getOrderByAlphabetButton().click();
    await alphabetResponsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).toHaveURL(/orderDirection=asc/);
    await expectVisibleTitles(['Order Alpha', 'Order Bravo', 'Order Charlie']);
    await collectionPage.getShowFunctionsButton().click();
    const descendingResponsePromise = itemsResponse(page, ['orderDirection=desc']);
    await collectionPage.getOrderDirectionDescButton().click();
    await descendingResponsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).not.toHaveURL(/orderDirection=/);
    await expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);
    const reloadResponsePromise = itemsResponse(page, ['orderBy=alphabet', 'orderDirection=desc']);
    await page.reload();
    await reloadResponsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expectVisibleTitles(['Order Charlie', 'Order Bravo', 'Order Alpha']);
  });

  test('applies order from the query string', async ({ page, api }) => {
    await seedItems(api, [
      buildCollectionItem('Query Alpha', 'movie', 'tt8400031'),
      buildCollectionItem('Query Charlie', 'movie', 'tt8400032'),
      buildCollectionItem('Query Bravo', 'movie', 'tt8400033'),
    ]);
    const responsePromise = itemsResponse(page, ['orderBy=alphabet', 'orderDirection=asc']);
    await collectionPage.visitLibraryWithQuery('orderBy=alphabet&orderDirection=asc');
    await responsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).toHaveURL(/orderDirection=asc/);
    await expectVisibleTitles(['Query Alpha', 'Query Bravo', 'Query Charlie']);
  });

  test('keeps order query params when an item is opened and closed', async ({ page, api }) => {
    await seedItems(api, [buildCollectionItem('Order Url Movie', 'movie', 'tt8400034')]);
    await collectionPage.visitLibraryWithQuery('orderBy=alphabet');
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).toHaveURL(/item=omdb:tt8400034/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).not.toHaveURL(/item=/);
  });

  test('keeps order preferences isolated per collection page', async ({ page, api }) => {
    await seedItems(api, [
      buildCollectionItem('Library Alpha', 'movie', 'tt8400011'),
      buildCollectionItem('Library Bravo', 'movie', 'tt8400012'),
    ]);
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Alpha', 'movie', 'tt8400013'),
      listType: 'wishlist',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Bravo', 'movie', 'tt8400014'),
      listType: 'wishlist',
    });
    const initialResponsePromise = itemsResponse(page);
    await collectionPage.visit();
    await initialResponsePromise;
    await collectionPage.getShowFunctionsButton().click();
    const alphabetResponsePromise = itemsResponse(page, ['orderBy=alphabet']);
    await collectionPage.getOrderByAlphabetButton().click();
    await alphabetResponsePromise;
    await collectionPage.getShowFunctionsButton().click();
    const ascendingResponsePromise = itemsResponse(page, ['orderBy=alphabet', 'orderDirection=asc']);
    await collectionPage.getOrderDirectionAscButton().click();
    await ascendingResponsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    await expect(page).toHaveURL(/orderDirection=asc/);
    await expectVisibleTitles(['Library Alpha', 'Library Bravo']);
    await commonPage.openMenu();
    const wishlistResponsePromise = itemsResponse(page, [
      'listType=wishlist',
      'orderBy=createdAt',
      'orderDirection=desc',
    ]);
    await commonPage.getNavWishlistLink().click();
    await wishlistResponsePromise;
    await expect(page).toHaveURL(/#\/collection\/wishlist/);
    await expect(page).not.toHaveURL(/orderBy=/);
    await expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);
    await collectionPage.getShowFunctionsButton().click();
    const wishlistAlphabetResponsePromise = itemsResponse(page, ['listType=wishlist', 'orderBy=alphabet']);
    await collectionPage.getOrderByAlphabetButton().click();
    await wishlistAlphabetResponsePromise;
    await expect(page).toHaveURL(/orderBy=alphabet/);
    const reloadResponsePromise = itemsResponse(page, ['listType=wishlist', 'orderBy=alphabet']);
    await page.reload();
    await reloadResponsePromise;
    await expectVisibleTitles(['Wishlist Bravo', 'Wishlist Alpha']);
    await commonPage.openMenu();
    const libraryResponsePromise = itemsResponse(page, ['listType=library', 'orderBy=alphabet', 'orderDirection=asc']);
    await commonPage.getNavCollectionLink().click();
    await libraryResponsePromise;
    await expectVisibleTitles(['Library Alpha', 'Library Bravo']);
  });

  test('shows order controls on secondary collection pages', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Order', 'movie', 'tt8400021'),
      listType: 'up-next',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Wishlist Order', 'movie', 'tt8400022'),
      listType: 'wishlist',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Series Tracker Order', 'series', 'tt8400023'),
      listType: 'tracking',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Movie Tracker Order', 'movie', 'tt8400025'),
      listType: 'tracking',
    });
    for (const [listType, link] of [
      ['up-next', commonPage.getNavUpNextLink()],
      ['wishlist', commonPage.getNavWishlistLink()],
      ['tracking', commonPage.getNavTrackingLink()],
    ] as const) {
      await commonPage.openMenu();
      const responsePromise = itemsResponse(page, [`listType=${listType}`]);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#/collection/${listType}`));
      await responsePromise;
      await showOrderControls();
    }
  });
});

test.describe('Collection — favorites', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await seedItems(api, [
      buildCollectionItem('Favorite Test Movie', 'movie', 'tt8000001'),
      buildCollectionItem('Regular Test Movie', 'movie', 'tt8000002'),
    ]);
    await collectionPage.visit();
  });
  test('marks an item as favorite and filters favorites from the library actions menu', async ({ page }) => {
    await expect(collectionPage.getListItems()).toHaveCount(2);
    await collectionPage.getListItems().filter({ hasText: 'Favorite Test Movie' }).click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogMarkFavoriteButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogRemoveFavoriteButton()).toBeVisible();
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getFavoriteBadges()).toHaveCount(1);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('favorite').click();
    await expect(page).toHaveURL(/#\/collection\/library/);
    await expect(page).toHaveURL(/favorite=true/);
    await expect(await collectionPage.getSearchInput()).toHaveValue('');
    await expectVisibleTitles(['Favorite Test Movie']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Regular Test Movie' })).toHaveCount(0);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('favorite').click();
    await expect(page).not.toHaveURL(/search=/);
    await expect(page).not.toHaveURL(/favorite=true/);
    await expect(page).toHaveURL(/#\/collection\/library/);
    await expect(await collectionPage.getSearchInput()).toHaveValue('');
    await expect(collectionPage.getListItems()).toHaveCount(2);
  });
});

test.describe('Collection — watch later', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });
  test('adds a manual watch later item and persists it after reload', async ({ page }) => {
    const manualTitle = 'Manual Watch Later Movie';
    await commonPage.openMenu();
    await commonPage.getNavUpNextLink().click();
    await collectionPage.getAddFirstUpNextItemLink().click();
    await saveManualItem(page, manualTitle, 'tt8110001', 'movie', 'up-next');
    await reloadAndExpectPersistedTitle(page, manualTitle);
  });
});

test.describe('Collection — wishlist', () => {
  const wishlistTitle = 'Wishlist Test Movie';
  test.beforeEach(async ({ page, autoLogin }) => {
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbSearchResult(wishlistTitle, 'tt8100001') } })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbItem(wishlistTitle, 'tt8100001') } })
    );
    await autoLogin();
  });
  test('navigates via the menu and adds a wishlist item from the empty state', async ({ page }) => {
    await commonPage.openMenu();
    await commonPage.getNavWishlistLink().click();
    await expect(page).toHaveURL(/#\/collection\/wishlist/);
    await expect(page.getByTestId('collection-search')).toHaveCount(0);
    await collectionPage.getAddFirstWishlistItemLink().click();
    await collectionPage.getNewItemSearchInput().fill(wishlistTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await expectVisibleTitles([wishlistTitle]);
  });
  test('adds a manual wishlist item and persists it after reload', async ({ page }) => {
    const manualTitle = 'Manual Wishlist Movie';
    await commonPage.openMenu();
    await commonPage.getNavWishlistLink().click();
    await collectionPage.getAddFirstWishlistItemLink().click();
    await saveManualItem(page, manualTitle, 'tt8100002', 'movie', 'wishlist');
    await reloadAndExpectPersistedTitle(page, manualTitle);
  });
});

test.describe('Collection — tracking series', () => {
  const seriesTitle = 'Series Tracker Test Show';
  test.beforeEach(async ({ page, autoLogin }) => {
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({
        status: 200,
        json: {
          data: {
            results: [
              buildOmdbItem('Filtered Movie Result', 'tt8200000', 'movie'),
              buildOmdbItem(seriesTitle, 'tt8200001', 'series'),
            ],
          },
        },
      })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbItem(seriesTitle, 'tt8200001', 'series') } })
    );
    await autoLogin();
  });
  test('adds a series and persists watched-up-to progress', async ({ page, api }) => {
    await commonPage.openMenu();
    await commonPage.getNavTrackingLink().click();
    await expect(page).toHaveURL(/#\/collection\/tracking/);
    await expect(page.getByTestId('collection-search')).toHaveCount(0);
    await collectionPage.getAddFirstTrackingItemLink().click();
    await collectionPage.getNewItemContentSelect().selectOption('series');
    await collectionPage.getNewItemSearchInput().fill(seriesTitle);
    await expect(collectionPage.getNewItemContentOptions()).toHaveCount(1);
    await expect(collectionPage.getNewItemContentOptions()).toContainText(seriesTitle);
    await expect(page.getByTestId('new-item-user-rate')).toHaveCount(0);
    await expect(page.getByTestId('new-item-finished')).toHaveCount(0);
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await expectVisibleTitles([seriesTitle]);
    await api.request('PUT', '/api/v1/collection-items/omdb/tt8200001/tracking/seasons', {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await reloadAndExpectPersistedTitle(page, seriesTitle);
    await closeOpenDialogThenClickFirstItem(page);
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    const firstResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/completed-episodes')
    );
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0).check();
    expect((await firstResponsePromise).status()).toBe(200);
    const secondResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/completed-episodes')
    );
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(1).check();
    expect((await secondResponsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E02');
    await reloadAndExpectPersistedTitle(page, seriesTitle);
    await closeOpenDialogThenClickFirstItem(page);
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E02');
  });
  test('adds a manual tracking item and persists it after reload', async ({ page }) => {
    const manualTitle = 'Manual Series Tracker Show';
    await commonPage.openMenu();
    await commonPage.getNavTrackingLink().click();
    await collectionPage.getAddFirstTrackingItemLink().click();
    await saveManualItem(page, manualTitle, 'tt8200002', 'series', 'tracking');
    await reloadAndExpectPersistedTitle(page, manualTitle);
  });
});

test.describe('Collection — tracking movies', () => {
  const movieTitle = 'Movie Tracker Test Movie';
  test.beforeEach(async ({ page, autoLogin }) => {
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({
        status: 200,
        json: {
          data: {
            results: [
              buildOmdbItem('Filtered Series Result', 'tt8300000', 'series'),
              buildOmdbItem(movieTitle, 'tt8300001', 'movie'),
            ],
          },
        },
      })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbItem(movieTitle, 'tt8300001', 'movie') } })
    );
    await autoLogin();
  });
  test('navigates via the menu and adds a tracking item from the empty state', async ({ page }) => {
    await commonPage.openMenu();
    await commonPage.getNavTrackingLink().click();
    await expect(page).toHaveURL(/#\/collection\/tracking/);
    await expect(page.getByTestId('collection-search')).toHaveCount(0);
    await collectionPage.getAddFirstTrackingItemLink().click();
    await collectionPage.getNewItemContentSelect().selectOption('movie');
    await collectionPage.getNewItemSearchInput().fill(movieTitle);
    await expect(collectionPage.getNewItemContentOptions()).toHaveCount(1);
    await expect(collectionPage.getNewItemContentOptions()).toContainText(movieTitle);
    await expect(page.getByTestId('new-item-user-rate')).toHaveCount(0);
    await expect(page.getByTestId('new-item-finished')).toHaveCount(0);
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await expectVisibleTitles([movieTitle]);
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(1);
  });
  test('adds a manual item from a non-empty tracking and persists it after reload', async ({ page, api }) => {
    const existingTitle = 'Existing Movie Tracker Item';
    const manualTitle = 'Manual Movie Tracker Item';
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(existingTitle, 'movie', 'tt8300002'),
      listType: 'tracking',
    });
    const responsePromise = itemsResponse(page);
    await collectionPage.visitTracking();
    await responsePromise;
    await expect(collectionPage.getListItems().filter({ hasText: existingTitle })).toBeVisible();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await saveManualItem(page, manualTitle, 'tt8300003', 'movie', 'tracking');
    await reloadAndExpectPersistedTitle(page, manualTitle, 2);
    await expect(collectionPage.getListItems().filter({ hasText: existingTitle })).toBeVisible();
  });
  test('opens the item dialog and shows watched status without episode controls', async ({ api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(movieTitle, 'movie', 'tt8300001'),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogCompletedChip()).toHaveCount(0);
    await expect(collectionPage.getItemDialogManageCompletedEpisodesButton()).toHaveCount(0);
    await expect(collectionPage.getItemDialogManageSeriesMetadataButton()).toHaveCount(0);
    await collectionPage.closeActiveDialogByOverlay();
  });
  test('moves a movie from watchlist to tracking', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watch Later Move Movie', 'movie', 'tt8300002'),
      listType: 'up-next',
    });
    await collectionPage.visitUpNext();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    await collectionPage.getItemDialogMoveFinishedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getEmptyState()).toBeVisible();
    await collectionPage.visitTracking();
    await expectVisibleTitles(['Watch Later Move Movie']);
  });
  test('deletes a tracking item and shows empty state', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Delete Tracker Movie', 'movie', 'tt8300003'),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogDeleteButton().click();
    expect((await responsePromise).status()).toBe(204);
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
  test('filters tracking items via search', async ({ api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Alpha Movie', 'movie', 'tt8300004'),
      listType: 'tracking',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Beta Movie', 'movie', 'tt8300005'),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems()).toHaveCount(2);
    await fillAutocomplete(await collectionPage.getTrackingSearchInput(), 'Alpha');
    await expectVisibleTitles(['Alpha Movie']);
  });
});

test.describe('Collection — unified tracking gaps', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('filters tracking items with media chips', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Chip Movie', 'movie', 'tt8500001'),
      listType: 'tracking',
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Chip Series', 'series', 'tt8500002'),
      listType: 'tracking',
    });
    const initialResponsePromise = itemsResponse(page, ['listType=tracking']);
    await collectionPage.visitTracking();
    await initialResponsePromise;
    await expect(collectionPage.getListItems()).toHaveCount(2);
    const movieResponsePromise = itemsResponse(page, ['listType=tracking', 'type=movie']);
    await collectionPage.getMediaChip('movie').click();
    await movieResponsePromise;
    await expect(page).toHaveURL(/type=movie/);
    await expectVisibleTitles(['Chip Movie']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Chip Series' })).toHaveCount(0);
    const seriesResponsePromise = itemsResponse(page, ['listType=tracking', 'type=series']);
    await collectionPage.getMediaChip('series').click();
    await seriesResponsePromise;
    await expect(page).toHaveURL(/type=series/);
    await expectVisibleTitles(['Chip Series']);
    await expect(collectionPage.getListItems().filter({ hasText: 'Chip Movie' })).toHaveCount(0);
    const allResponsePromise = itemsResponse(page, ['listType=tracking']);
    await collectionPage.getMediaChip('all').click();
    await allResponsePromise;
    await expect(page).not.toHaveURL(/type=movie|type=series/);
    await expect(collectionPage.getListItems()).toHaveCount(2);
  });

  test('moves a series from watchlist to tracking', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Watchlist Move Series', 'series', 'tt8500003'),
      listType: 'up-next',
    });
    await collectionPage.visitUpNext();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    await collectionPage.getItemDialogMoveTrackingButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getEmptyState()).toBeVisible();
    await collectionPage.visitTracking();
    await expectVisibleTitles(['Watchlist Move Series']);
  });

  test('copies a library series to tracking and can open the twin', async ({ page, api }) => {
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Library Copy Series', 'series', 'tt8500004')
    );
    await collectionPage.visit();
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    await collectionPage.getItemDialogCopyTrackingButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getItemDialogOpenInTrackingButton()).toBeVisible();
    await expect(collectionPage.getItemDialogRemoveTrackingButton()).toBeVisible();
    await collectionPage.closeActiveDialogByOverlay();
    await collectionPage.visitTracking();
    await expectVisibleTitles(['Library Copy Series']);
  });

  test('edits tracking book page progress and shows it on the list card', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Progress Tracking Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 10,
      progressTotal: 100,
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: 'Progress Tracking Book' })).toBeVisible();
    await expect(collectionPage.getListItemProgress()).toContainText('10 / 100');
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogProgressChip()).toContainText('10 / 100');
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogProgressCurrentInput().fill('55');
    await collectionPage.getItemDialogProgressTotalInput().fill('200');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getItemDialogProgressChip()).toContainText('55 / 200');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItemProgress()).toContainText('55 / 200');
  });

  test('marks a tracking book completed when page progress becomes equal', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Complete Progress Book', '9780140328721'),
      listType: 'tracking',
      progressCurrent: 10,
      progressTotal: 100,
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: 'Complete Progress Book' })).toBeVisible();
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(0);
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogProgressCurrentInput().fill('100');
    await collectionPage.getItemDialogProgressTotalInput().fill('100');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.item.progressCurrent).toBe(100);
    expect(body.data.item.progressTotal).toBe(100);
    expect(body.data.item.watchedAt).toEqual(expect.any(String));
    expect(body.data.item.watchedAt).not.toBe('');
    await expect(collectionPage.getItemDialogProgressChip()).toContainText('100 / 100');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItemProgress()).toContainText('100 / 100');
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(1);
  });

  test('uncompletes a tracking book when total pages is raised above pages read', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Uncomplete Progress Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 100,
      progressTotal: 100,
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: 'Uncomplete Progress Book' })).toBeVisible();
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(1);
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogProgressCurrentInput().fill('100');
    await collectionPage.getItemDialogProgressTotalInput().fill('200');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.item.progressCurrent).toBe(100);
    expect(body.data.item.progressTotal).toBe(200);
    expect(body.data.item.watchedAt).toBe(null);
    await expect(collectionPage.getItemDialogProgressChip()).toContainText('100 / 200');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItemProgress()).toContainText('100 / 200');
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(0);
  });

  test('keeps save disabled when total pages is lower than pages read', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Invalid Progress Book', '9780140328721'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    await collectionPage.visitTracking();
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogProgressCurrentInput().fill('120');
    await collectionPage.getItemDialogProgressTotalInput().fill('100');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
    const message = page.getByText('Total pages must be greater than or equal to pages read.', { exact: true });
    await message.scrollIntoViewIfNeeded();
    await expect(message).toBeVisible();
  });

  test('recovers save after fixing pages read above total pages', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Recover Progress Book', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    await collectionPage.visitTracking();
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogProgressCurrentInput().fill('150');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
    const message = page.getByText('Total pages must be greater than or equal to pages read.', { exact: true });
    await message.scrollIntoViewIfNeeded();
    await expect(message).toBeVisible();
    await collectionPage.getItemDialogProgressTotalInput().fill('200');
    await expect(collectionPage.getItemDialogSaveButton()).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.item.progressCurrent).toBe(150);
    expect(body.data.item.progressTotal).toBe(200);
    await expect(collectionPage.getItemDialogProgressChip()).toContainText('150 / 200');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItemProgress()).toContainText('150 / 200');
  });

  test('creates a tracking book with page progress from the new-item dialog', async ({ page }) => {
    await collectionPage.visitTracking();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemManualContentTypeSelect().selectOption('book');
    await collectionPage.getNewItemManualTitleInput().fill('Manual Progress Book');
    await collectionPage.getNewItemManualImdbIdInput().fill('9780140328721');
    await collectionPage.getNewItemManualProgressCurrentInput().fill('12');
    await collectionPage.getNewItemManualProgressTotalInput().fill('240');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/collection-items'
    );
    await collectionPage.getNewItemSaveAndCloseButton().click();
    const response = await responsePromise;
    expect(response.request().postDataJSON()).toMatchObject({
      title: 'Manual Progress Book',
      contentType: 'book',
      listType: 'tracking',
      progressCurrent: 12,
      progressTotal: 240,
    });
    expect(response.status()).toBe(200);
    await expect(collectionPage.getListItems().filter({ hasText: 'Manual Progress Book' })).toBeVisible();
    await expect(collectionPage.getListItemProgress()).toContainText('12 / 240');
  });

  test('saves a library series with copy-to-tracking-as-completed checked', async ({ page }) => {
    const seriesTitle = 'Copy Completed Series';
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbSearchResult(seriesTitle, 'tt8500005', 'series') } })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({ status: 200, json: { data: buildOmdbItem(seriesTitle, 'tt8500005', 'series') } })
    );
    await page.route('**/api/v1/collection-items/*/*/tracking/actions/mark-completed*', (route) =>
      route.fulfill({
        status: 200,
        json: {
          data: {
            completedEpisodes: [{ season: 1, episode: 1 }],
            lastCompletedEpisode: { season: 1, episode: 1 },
            item: null,
          },
        },
      })
    );
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemContentSelect().selectOption('series');
    await collectionPage.getNewItemSearchInput().fill(seriesTitle);
    await expect(collectionPage.getNewItemContentOptions().first()).toBeVisible();
    await collectionPage.getNewItemCopyToTrackingAsCompletedCheckbox().check();
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/collection-items'
    );
    const trackingResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    const completedResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/actions/mark-completed')
    );
    await collectionPage.getNewItemSaveAndCloseButton().click();
    expect((await createResponsePromise).status()).toBe(200);
    expect((await trackingResponsePromise).status()).toBe(200);
    expect((await completedResponsePromise).status()).toBe(200);
    await expect(collectionPage.getListItems().filter({ hasText: seriesTitle })).toBeVisible();
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: seriesTitle })).toBeVisible();
  });
});

test.describe('Collection - tag badge filtering', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Badge Test Movie', 'movie', 'tt6000001'),
      tags: ['#action'],
    });
    await api.request('POST', '/api/v1/users/me/tags', [
      {
        tag: '#action',
        color: '#ff0000',
        useForImageBorder: false,
        useForTextColor: false,
        useForImageBadge: true,
        weight: 1,
      },
    ]);
    await collectionPage.visit();
  });
  test('clicking a tag badge filters the collection by that tag', async () => {
    const badge = collectionPage.getListItemImageBadges();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('#action');
    await badge.click();
    await expectVisibleTitles(['Badge Test Movie']);
  });
});
