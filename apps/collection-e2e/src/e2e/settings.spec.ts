import { expect, test } from '../support/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { createSettingsPage } from '../page-objects/settings.po';
import type { Page } from '@playwright/test';

let collectionPage: ReturnType<typeof createCollectionPage>;
let commonPage: ReturnType<typeof createCommonPage>;
let settingsPage: ReturnType<typeof createSettingsPage>;

test.beforeEach(async ({ page }) => {
  collectionPage = createCollectionPage(page);
  commonPage = createCommonPage(page);
  settingsPage = createSettingsPage(page);
});

const openSettingsSections = async (page: Page) => {
  await page.evaluate(() => {
    window.localStorage.setItem('CT.DetailsBasics', 'true');
    window.localStorage.setItem('CT.DetailsUser', 'true');
    window.localStorage.setItem('CT.DetailsAccess tokens', 'true');
    window.localStorage.setItem('CT.DetailsImages', 'true');
    window.localStorage.setItem('CT.DetailsManage tracker data', 'true');
  });
};

const waitForApiResponse = (page: Page, method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

const acceptDialogs = (page: Page) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
};

test.describe('Settings - basic form fields', () => {
  test.beforeEach(async ({ autoLogin, page }) => {
    await autoLogin();
    await openSettingsSections(page);
    await settingsPage.visitBasics();
  });

  test('shows the language select', async () => {
    await expect(settingsPage.getLanguageSelect()).toBeVisible();
  });

  test('shows the animated background checkbox', async () => {
    await expect(settingsPage.getAnimatedBackgroundCheckbox()).toBeAttached();
  });

  test('hides the clear-local-storage-after-logout checkbox when storage is switched to session', async ({ page }) => {
    await settingsPage.getSensitiveDataStorageSelect().selectOption('session');
    await expect(page.getByTestId('settings-clear-local-storage-after-logout')).toHaveCount(0);
  });
});

test.describe('Settings - media refresh page', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
    await settingsPage.visitMediaRefresh();
  });

  test('shows the external ratings refresh action', async () => {
    await expect(settingsPage.getExternalRatingsRefreshStartButton()).toBeVisible();
  });

  test('calls the refresh images API when the image refresh button is clicked', async ({ page }) => {
    acceptDialogs(page);
    const refreshResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/refresh-images');
    await settingsPage.getImageRefreshStartButton().click();
    expect((await refreshResponsePromise).status()).toBe(200);
    const status = settingsPage.getImageRefreshStatus();
    await expect(status).toBeVisible();
    await expect(status).toContainText('Count');
    await expect(status).toContainText('Checked');
    await expect(status).toContainText('Fixed');
    await expect(status).toContainText('Errors');
  });
});

test.describe('Settings - collection list display page', () => {
  test.beforeEach(async ({ api, autoLoginWithNewUser }) => {
    await autoLoginWithNewUser();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('List Display Test Movie', 'movie', 'tt8100001'),
      rottenTomatoesRate: '96%',
      metacriticRate: '85/100',
    });
  });

  test('shows the display preference controls', async () => {
    await settingsPage.visitCollectionListDisplay();
    await expect(settingsPage.getCollectionListDisplayForm()).toBeVisible();
    await expect(settingsPage.getListShowSharedIconCheckbox()).toBeAttached();
    await expect(settingsPage.getListImdbRatingFallbackCheckbox()).toBeAttached();
  });

  test('applies preferred rating and year visibility to the collection list', async ({ page }) => {
    await settingsPage.visitCollectionListDisplay();
    let saveResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getListShowYearCheckbox().uncheck();
    expect((await saveResponsePromise).status()).toBe(200);
    saveResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getListPreferredRatingSelect().selectOption('metacritic');
    expect((await saveResponsePromise).status()).toBe(200);

    await collectionPage.visit();
    await expect(collectionPage.getListItems().filter({ hasText: 'List Display Test Movie' })).toBeVisible();
    await expect(collectionPage.getListItemYears()).toHaveCount(0);
    await expect(collectionPage.getListItemMetacriticRatings()).toContainText('85/100');
    await expect(collectionPage.getListItemImdbRatings()).toHaveCount(0);
  });
});

test.describe('Settings - features page', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('persists disabled features and hides their menu links', async ({ api, page }) => {
    await settingsPage.visitFeatures();
    await expect(settingsPage.getFeaturesForm()).toBeVisible();
    for (const checkbox of [
      settingsPage.getFeatureWishlistCheckbox(),
      settingsPage.getFeatureUpNextCheckbox(),
      settingsPage.getFeatureTrackingCheckbox(),
    ]) {
      const saveResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
      await checkbox.uncheck();
      expect((await saveResponsePromise).status()).toBe(200);
    }

    await page.reload();
    await expect(settingsPage.getFeatureWishlistCheckbox()).not.toBeChecked();
    await expect(settingsPage.getFeatureUpNextCheckbox()).not.toBeChecked();
    await expect(settingsPage.getFeatureTrackingCheckbox()).not.toBeChecked();

    await commonPage.openMenu();
    await expect(commonPage.getMenuNavItem('nav-wishlist')).toHaveCount(0);
    await expect(commonPage.getMenuNavItem('nav-up-next')).toHaveCount(0);
    await expect(commonPage.getMenuNavItem('nav-tracking')).toHaveCount(0);

    await page.goto('/client/#/collection/tracking');
    await expect(page).toHaveURL(/\/collection\/tracking/);
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Feature Statistics Movie', 'movie', 'tt8100002')
    );
    await page.goto('/client/#/statistics');
    await expect(page.getByTestId('statistics-summary-all')).toBeVisible();
    await expect(page.getByTestId('statistics-summary-wishlist')).toHaveCount(0);
    await expect(page.getByTestId('statistics-summary-up-next')).toHaveCount(0);
    await expect(page.getByTestId('statistics-summary-watched-movies')).toHaveCount(0);
    await expect(page.getByTestId('statistics-summary-watched-series')).toHaveCount(0);
  });

  test('hides the connected tracking option when adding a series', async ({ page }) => {
    await settingsPage.visitFeatures();
    const saveResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureTrackingCheckbox().uncheck();
    expect((await saveResponsePromise).status()).toBe(200);

    await collectionPage.visit();
    await collectionPage.getAddFirstItemLink().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemManualContentTypeSelect().selectOption('series');
    await expect(collectionPage.getNewItemCopyToTrackingAsCompletedCheckbox()).toHaveCount(0);
  });

  test('opens feature settings from the settings navigation', async ({ page }) => {
    await settingsPage.visitBasics();
    await settingsPage.getNavToggle().click();
    await page.getByTestId('settings-nav-features').click();
    await expect(page).toHaveURL(/\/settings\/features/);
    await expect(settingsPage.getFeaturesForm()).toBeVisible();
  });

  test('uses session storage for the feature cache when configured', async ({ page }) => {
    await settingsPage.visitBasics();
    await settingsPage.getSensitiveDataStorageSelect().selectOption('session');
    await settingsPage.visitFeatures();
    const saveResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureWishlistCheckbox().uncheck();
    expect((await saveResponsePromise).status()).toBe(200);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          session: window.sessionStorage.getItem('CT.CollectionFeaturePreferences'),
          local: window.localStorage.getItem('CT.CollectionFeaturePreferences'),
        }))
      )
      .toEqual({ session: expect.stringContaining('"wishlist":false'), local: null });
  });
});

test.describe('Settings - mark all completed / uncompleted', () => {
  test.beforeEach(async ({ api, autoLogin, page }) => {
    await autoLogin();
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Watch Test Movie A', 'movie', 'tt8000001')
    );
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Watch Test Movie B', 'movie', 'tt8000002')
    );
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Watch Test Series', 'series', 'tt8000003')
    );
    await api.request('POST', '/api/v1/collection-items', buildBooksItem('Watch Test Book A', '9780132350884'));
    await api.request('POST', '/api/v1/collection-items', buildBooksItem('Watch Test Book B', '9780201633610'));
    await page.goto('/client/#/collection/library');
    const collectionResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/collection-items');
    await page.reload();
    await collectionResponsePromise;
    await settingsPage.visitManageTrackerData();
  });

  test('marks all movies as completed and persists them in tracking', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-movies-completed');
    await settingsPage.getMarkAllCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems()).toHaveCount(2);
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Movie A' })).toBeVisible();
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Movie B' })).toBeVisible();
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(2);
  });

  test('marks all movies as uncompleted and removes them from tracking', async ({ page }) => {
    acceptDialogs(page);
    let responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-movies-completed');
    await settingsPage.getMarkAllCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-movies-uncompleted');
    await settingsPage.getMarkAllUncompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('mark all series as completed calls the bulk update API', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-series-completed');
    await settingsPage.getMarkAllSeriesCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
  });

  test('mark all series as uncompleted calls the bulk update API', async ({ page }) => {
    acceptDialogs(page);
    let responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-series-completed');
    await settingsPage.getMarkAllSeriesCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-series-uncompleted');
    await settingsPage.getMarkAllSeriesUncompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
  });

  test('marks all books as completed and persists them in tracking', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-books-completed');
    await settingsPage.getMarkAllBooksCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Book A' })).toBeVisible();
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Book B' })).toBeVisible();
    await expect.poll(() => collectionPage.getTrackingCompletedBadges().count()).toBeGreaterThanOrEqual(2);
  });

  test('marks all books as uncompleted and keeps tracking items without completed badges', async ({ page }) => {
    acceptDialogs(page);
    let responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-books-completed');
    await settingsPage.getMarkAllBooksCompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    responsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items/actions/mark-books-uncompleted');
    await settingsPage.getMarkAllBooksUncompletedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Book A' })).toBeVisible();
    await expect(collectionPage.getListItems().filter({ hasText: 'Watch Test Book B' })).toBeVisible();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('completed').click();
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('remove all tracked movie data calls the delete API and empties the tracker', async ({ api, page }) => {
    acceptDialogs(page);
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Tracked Movie', 'movie', 'tt8000004'),
      listType: 'tracking',
    });
    const responsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/tracking/completed-movies');
    await settingsPage.getRemoveAllTrackedMovieDataButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('removes all tracked series data and persists an empty tracking', async ({ api, page }) => {
    acceptDialogs(page);
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Tracked Series', 'series', 'tt8000005'),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItems()).toContainText('Tracked Series');
    await settingsPage.visitManageTrackerData();
    const responsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/tracking');
    await settingsPage.getRemoveAllTrackedSeriesDataButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.visitTracking();
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
});

test.describe('Settings - save changes', () => {
  test.beforeEach(async ({ autoLogin, page }) => {
    await autoLogin();
    await openSettingsSections(page);
    await settingsPage.visitBasics();
  });

  test('saves a changed theme', async ({ page }) => {
    const themeSelect = settingsPage.getThemeSelect();
    const currentValue = await themeSelect.inputValue();
    const newValue = await themeSelect
      .locator('option')
      .evaluateAll(
        (options, selectedValue) =>
          options.find((option) => option.getAttribute('value') !== selectedValue)?.getAttribute('value'),
        currentValue
      );
    if (!newValue) throw new Error('Theme selector has no alternative option');
    const responsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await themeSelect.selectOption(newValue);
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().theme).toBe(newValue);
  });
});

test.describe('Settings - navigate to settings via menu', () => {
  test.beforeEach(async ({ autoLogin, page }) => {
    await autoLogin();
    await openSettingsSections(page);
  });

  test('opens the settings page from the navigation menu', async ({ page }) => {
    await commonPage.navigateToSettingsViaMenu();
    await expect(page).toHaveURL(/#\/settings/);
    await expect(settingsPage.getBasicsForm()).toBeVisible();
  });
});

test.describe('Settings - account actions (destructive)', () => {
  test.beforeEach(async ({ autoLoginWithNewUser }) => {
    await autoLoginWithNewUser();
    await settingsPage.visitAccount();
  });

  test('create new user token calls PUT /api/v1/users/me/token and shows the token dialog', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'PUT', '/api/v1/users/me/token');
    await settingsPage.getCreateUserTokenButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(settingsPage.getTokenDialogValue()).toBeVisible();
    await expect(settingsPage.getTokenDialogValue()).not.toBeEmpty();
  });

  test('delete user calls DELETE /api/v1/users/me and redirects to login', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/users/me');
    await settingsPage.getDeleteUserButton().click();
    expect((await responsePromise).status()).toBe(204);
    await expect(page).toHaveURL(/\/login\//);
  });
});

test.describe('Settings - access tokens', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
    await settingsPage.visitAccessTokens();
  });

  test('create access token calls POST /api/v1/users/me/access-tokens and shows the token dialog', async ({ page }) => {
    acceptDialogs(page);
    const responsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/access-tokens');
    await settingsPage.getCreateAccessTokenButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(settingsPage.getTokenDialogValue()).toBeVisible();
    await expect(settingsPage.getTokenDialogValue()).not.toBeEmpty();
  });

  test('revoke access token calls DELETE /api/v1/users/me/access-tokens/:hash', async ({ api, page }) => {
    acceptDialogs(page);
    const createResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/access-tokens');
    await settingsPage.getCreateAccessTokenButton().click();
    expect((await createResponsePromise).status()).toBe(200);
    await collectionPage.closeActiveDialogByOverlay();
    const tokensResponse = await api.request('GET', '/api/v1/users/me/access-tokens');
    const tokensBody = (await tokensResponse.json()) as { data: { tokenHash: string }[] };
    const revokeResponsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/users/me/access-tokens/');
    await settingsPage.getRevokeTokenButton(tokensBody.data[0].tokenHash).click();
    expect((await revokeResponsePromise).status()).toBe(204);
  });
});

test.describe('Settings - appMode: full (all permissions)', () => {
  test.beforeEach(async ({ api, autoLogin }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Full Mode Movie', 'movie', 'tt8300001'));
    await collectionPage.visit();
  });

  test('the add-new float button is visible', async () => {
    await collectionPage.getShowFunctionsButton().click();
    await expect(collectionPage.getAddNewButton()).toBeVisible();
  });

  test('the item dialog shows edit, delete, and mark-watched buttons', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogEditButton()).toBeVisible();
    await expect(collectionPage.getItemDialogDeleteButton()).toBeVisible();
    await expect(collectionPage.getItemDialogMarkFinishedButton()).toBeVisible();
  });
});
