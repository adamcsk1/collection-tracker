import type { Page } from '@playwright/test';
import { buildOmdbItem, buildOmdbSearchResult } from '../fixtures/omdb';
import { createCollectionPage } from '../page-objects/collection.po';
import { createSettingsPage } from '../page-objects/settings.po';
import type { CollectionPageEnvelope, ShareGrant, TestUser } from '../support/share-helper-model';
import {
  createShareHelpers,
  expectGrant,
  expectNoGrant,
  grant,
  libraryMovieSeriesGrants,
  uniqueImdbId,
} from '../support/share-helpers';
import { expect, test } from '../support/test';

let page: Page;
let collectionPage: ReturnType<typeof createCollectionPage>;
let settingsPage: ReturnType<typeof createSettingsPage>;
let shareHelpers: ReturnType<typeof createShareHelpers>;

const waitForResponse = (method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

const visitSharedList = async (
  sharedUser: TestUser,
  list: 'library' | 'wishlist' | 'tracking' | 'books' | 'up-next' = 'library'
): Promise<void> => {
  await shareHelpers.signInThroughUi(sharedUser);
  const itemsLoad = waitForResponse('GET', '/api/v1/collection-items');
  switch (list) {
    case 'wishlist':
      await collectionPage.visitWishlist();
      break;
    case 'tracking':
      await collectionPage.visitTracking();
      break;
    case 'books':
      await collectionPage.visitBooks();
      break;
    case 'up-next':
      await collectionPage.visitUpNext();
      break;
    default:
      await collectionPage.visit();
  }
  await itemsLoad;
};

const assertDialogPermissions = async (permissions: { update: boolean; delete: boolean }): Promise<void> => {
  await collectionPage.expectItemDialogActionsVisible();

  if (permissions.update) {
    await expect(collectionPage.getItemDialogEditButton()).toBeVisible();
  } else {
    await expect(page.getByTestId('item-dialog-edit')).toHaveCount(0);
  }

  if (permissions.delete) {
    await expect(collectionPage.getItemDialogDeleteButton()).toBeVisible();
  } else {
    await expect(page.getByTestId('item-dialog-delete')).toHaveCount(0);
  }
};

const openFloatFilters = async (): Promise<void> => {
  await collectionPage.getShowFunctionsButton().click();
};

test.beforeEach(async ({ page: currentPage, api }) => {
  page = currentPage;
  collectionPage = createCollectionPage(page);
  settingsPage = createSettingsPage(page);
  shareHelpers = createShareHelpers(page, api);
});

test.afterEach(async () => {
  await shareHelpers.cleanupCreatedUsers();
});

test.describe('Collection sharing - settings management', () => {
  test('creates multi-scope grants, updates one scope, removes and revokes shares', async () => {
    const owner = await shareHelpers.createUser('owner');
    const sharedUser = await shareHelpers.createUser('shared');
    await shareHelpers.signInThroughUi(owner);
    await settingsPage.visitShares();

    await expect(settingsPage.getShareCode()).toContainText(owner.shareCode);
    await settingsPage.getAddShareOpenButton().click();
    await expect(settingsPage.getShareDialog()).toBeVisible();
    await expect(settingsPage.getShareDialogDependency()).toBeAttached();
    await settingsPage.getShareDialogUserHashInput().fill(sharedUser.shareCode);

    // Default library movie/series View is on. A child permission enables View for an unread scope.
    await settingsPage.getAddShareGrantCheckbox('library', 'movie', 'can-create').check();
    await settingsPage.getAddShareGrantCheckbox('wishlist', 'movie', 'can-delete').check();
    await expect(settingsPage.getAddShareGrantCheckbox('wishlist', 'movie', 'can-read')).toBeChecked();

    let saveShareResponse = waitForResponse('POST', '/api/v1/users/me/shares');
    let reloadSharesResponse = waitForResponse('GET', '/api/v1/users/me/shares');
    await settingsPage.getShareDialogSaveButton().click();
    let response = await saveShareResponse;
    expect(response.status()).toBe(204);
    let requestBody = response.request().postDataJSON() as { grants: ShareGrant[] };
    expect(requestBody.grants).toBeInstanceOf(Array);
    expectGrant(requestBody.grants, 'library', 'movie', { canRead: true, canCreate: true });
    expectGrant(requestBody.grants, 'library', 'series', { canRead: true, canCreate: false });
    expectGrant(requestBody.grants, 'wishlist', 'movie', { canRead: true, canDelete: true });
    expectNoGrant(requestBody.grants, 'wishlist', 'series');
    expect((await reloadSharesResponse).status()).toBe(200);

    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    await expect(settingsPage.getShareDialog()).toBeVisible();
    await expect(settingsPage.getShareDialogTitle()).toContainText(sharedUser.username);
    await expect(settingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-create')).toBeChecked();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read')).toBeChecked();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-delete')).toBeChecked();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('library', 'series', 'can-create')).not.toBeChecked();

    // Turning off parent View clears children. Enabling a child restores View.
    await settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read').uncheck();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-delete')).not.toBeChecked();
    await settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-update').check();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-read')).toBeChecked();
    saveShareResponse = waitForResponse('POST', '/api/v1/users/me/shares');
    reloadSharesResponse = waitForResponse('GET', '/api/v1/users/me/shares');
    await settingsPage.getShareDialogSaveButton().click();
    response = await saveShareResponse;
    expect(response.status()).toBe(204);
    requestBody = response.request().postDataJSON() as { grants: ShareGrant[] };
    expectGrant(requestBody.grants, 'wishlist', 'movie', { canRead: true, canUpdate: true });
    expectGrant(requestBody.grants, 'library', 'movie', { canCreate: true });
    expect((await reloadSharesResponse).status()).toBe(200);
    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'movie', 'can-update')).toBeChecked();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-update')).not.toBeChecked();
    await page.locator('body').press('Escape');

    page.on('dialog', (dialog) => dialog.accept());
    const removeShareResponse = waitForResponse('DELETE', '/api/v1/users/me/shares/');
    await settingsPage.getRemoveShareButton(sharedUser.shareCode).click();
    expect((await removeShareResponse).status()).toBe(204);

    // Re-share for revoke path with multi-scope grants.
    const shareResponse = await shareHelpers.requestAs(owner, 'POST', '/api/v1/users/me/shares', {
      sharedWithUserShareCode: sharedUser.shareCode,
      grants: [
        grant('library', 'movie', { canRead: true }),
        grant('wishlist', 'series', { canRead: true, canCreate: true }),
      ],
    });
    expect(shareResponse.status()).toBe(204);

    await shareHelpers.signInThroughUi(sharedUser);
    await settingsPage.visitShares();
    await expect(page.getByRole('heading', { name: owner.username, exact: true })).toBeVisible();
    await settingsPage.getViewIncomingShareButton(owner.shareCode).click();
    await expect(settingsPage.getShareDialog()).toBeVisible();
    await expect(settingsPage.getShareDialogTitle()).toContainText(owner.username);
    await expect(settingsPage.getShareDialogMessage()).toContainText('Permissions are read only');
    await expect(settingsPage.getShareDialogDependency()).toHaveCount(0);
    await expect(settingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read')).toBeChecked();
    await expect(settingsPage.getOutgoingShareGrantCheckbox('wishlist', 'series', 'can-create')).toBeChecked();
    await expect(settingsPage.getShareDialogSaveButton()).toHaveCount(0);
    await page.locator('body').press('Escape');

    const revokeShareResponse = waitForResponse('DELETE', '/api/v1/users/me/shares/incoming/');
    await settingsPage.getRevokeIncomingShareButton(owner.shareCode).click();
    expect((await revokeShareResponse).status()).toBe(204);
  });
});

test.describe('Collection sharing - library movie permissions', () => {
  test('shows read-only shared items without edit or delete actions', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })
    );
    await shareHelpers.seedOwnerItem(owner, { title: 'Shared Read Movie', externalId: uniqueImdbId() });
    await visitSharedList(sharedUser);

    await expect(collectionPage.getListItemByTitle('Shared Read Movie')).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toBeVisible();
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogSharedLibraryBadge()).toContainText(owner.username);
    await assertDialogPermissions({ update: false, delete: false });
    // Mark watched remains available from library without update grant (personal twin).
    await expect(collectionPage.getItemDialogMarkFinishedButton()).toBeVisible();
  });

  test('allows adding a new item to a shared library with create permission', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })
    );
    const title = 'Shared Create Movie';
    const imdbId = uniqueImdbId();
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: buildOmdbSearchResult(title, imdbId) }),
      })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: buildOmdbItem(title, imdbId) }),
      })
    );

    await visitSharedList(sharedUser);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    const omdbSearchResponse = waitForResponse('GET', '/api/v1/external-metadata/search');
    await collectionPage.getNewItemSearchInput().fill(title);
    await omdbSearchResponse;
    await collectionPage.getNewItemLibrarySelect().selectOption(owner.shareCode);
    const omdbItemResponse = waitForResponse('GET', '/api/v1/external-metadata/items');
    const createItemResponse = waitForResponse('POST', '/api/v1/collection-items');
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await omdbItemResponse;
    const response = await createItemResponse;
    expect(response.status()).toBe(200);
    const requestBody = response.request().postDataJSON() as {
      targetOwnerShareCode: string;
      contentType: string;
    };
    expect(requestBody.targetOwnerShareCode).toBe(owner.shareCode);
    expect(requestBody.contentType).toBe('movie');
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toBeVisible();

    // Owner still owns the row.
    const ownerItemsResponse = await shareHelpers.requestAs(
      owner,
      'GET',
      '/api/v1/collection-items?listType=library&limit=50'
    );
    const ownerItems = (await ownerItemsResponse.json()) as CollectionPageEnvelope<{
      title: string;
      ownerShareCode?: string;
    }>;
    expect(ownerItems.data.some((item) => item.title === title)).toBe(true);
  });

  test('adds a manual item to a shared library and persists it after reload', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })
    );
    const title = 'Shared Manual Movie';
    const imdbId = uniqueImdbId();
    await visitSharedList(sharedUser);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemLibrarySelect().selectOption(owner.shareCode);
    await collectionPage.getNewItemManualTitleInput().fill(title);
    await collectionPage.getNewItemManualImdbIdInput().fill(imdbId);

    const createManualItemResponse = waitForResponse('POST', '/api/v1/collection-items');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    await collectionPage.getNewItemSaveAndCloseButton().click();
    const response = await createManualItemResponse;
    const requestBody = response.request().postDataJSON() as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      title,
      IMDbId: imdbId,
      externalProvider: 'omdb',
      externalItemId: imdbId,
      contentType: 'movie',
      targetOwnerShareCode: owner.shareCode,
    });
    expect(response.status()).toBe(200);

    const manualItemsReload = waitForResponse('GET', '/api/v1/collection-items');
    await page.reload();
    await manualItemsReload;
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toHaveCount(1);
  });

  test('uses the configured default shared library when adding a new item', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: false, canDelete: false })
    );
    const title = 'Shared Default Movie';
    const imdbId = uniqueImdbId();
    await page.route('**/api/v1/external-metadata/search*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: buildOmdbSearchResult(title, imdbId) }),
      })
    );
    await page.route('**/api/v1/external-metadata/items*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: buildOmdbItem(title, imdbId) }),
      })
    );

    await shareHelpers.signInThroughUi(sharedUser);
    await settingsPage.visitShares();
    await settingsPage.getViewIncomingShareButton(owner.shareCode).click();
    const saveDefaultOwnerResponse = waitForResponse('POST', '/api/v1/users/me/settings');
    await settingsPage.getIncomingShareDefaultCheckbox('library', 'movie').check();
    const settingsResponse = await saveDefaultOwnerResponse;
    expect(settingsResponse.status()).toBe(200);
    const settingsBody = settingsResponse.request().postDataJSON() as { defaultCollectionOwners: unknown };
    expect(settingsBody.defaultCollectionOwners).toEqual([
      { listType: 'library', contentType: 'movie', ownerUserShareCode: owner.shareCode },
    ]);
    await settingsPage.closeShareDialogByOverlay();

    await visitSharedList(sharedUser);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    const omdbSearchResponse = waitForResponse('GET', '/api/v1/external-metadata/search');
    await collectionPage.getNewItemSearchInput().fill(title);
    await omdbSearchResponse;
    await expect(collectionPage.getNewItemLibrarySelect()).toHaveValue(owner.shareCode);
    const omdbItemResponse = waitForResponse('GET', '/api/v1/external-metadata/items');
    const createItemResponse = waitForResponse('POST', '/api/v1/collection-items');
    await collectionPage.getNewItemSaveAndCloseButton().click();
    await omdbItemResponse;
    const createResponse = await createItemResponse;
    const createBody = createResponse.request().postDataJSON() as { targetOwnerShareCode: string };
    expect(createBody.targetOwnerShareCode).toBe(owner.shareCode);
  });

  test('allows editing with update permission but hides delete', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: true, canDelete: false })
    );
    await shareHelpers.seedOwnerItem(owner, { title: 'Shared Update Movie', externalId: uniqueImdbId() });
    await visitSharedList(sharedUser);

    const updateItemResponse = waitForResponse('PUT', '/api/v1/collection-items/');
    await collectionPage.getListItemImages().first().click();
    await assertDialogPermissions({ update: true, delete: false });
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Shared Updated Movie');
    page.once('dialog', (dialog) => dialog.accept());
    await collectionPage.getItemDialogSaveButton().click();
    const response = await updateItemResponse;
    expect(response.status()).toBe(200);
    expect(response.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    await expect(collectionPage.getListItemByTitle('Shared Updated Movie')).toBeVisible();
  });

  test('allows deleting with delete permission but hides edit action', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: true })
    );
    await shareHelpers.seedOwnerItem(owner, { title: 'Shared Delete Movie', externalId: uniqueImdbId() });
    await visitSharedList(sharedUser);

    const deleteItemResponse = waitForResponse('DELETE', '/api/v1/collection-items/');
    page.on('dialog', (dialog) => dialog.accept());
    await collectionPage.getListItemImages().first().click();
    await assertDialogPermissions({ update: false, delete: true });
    await collectionPage.getItemDialogDeleteButton().click();
    const response = await deleteItemResponse;
    expect(response.status()).toBe(204);
    expect(response.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('shows every detail action when all shared permissions are granted', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: true, canUpdate: true, canDelete: true })
    );
    await shareHelpers.seedOwnerItem(owner, { title: 'Shared Full Movie', externalId: uniqueImdbId() });
    await visitSharedList(sharedUser);

    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogSharedLibraryBadge()).toContainText(owner.username);
    await assertDialogPermissions({ update: true, delete: true });
    await expect(collectionPage.getItemDialogMarkFinishedButton()).toBeVisible();
  });
});

test.describe('Collection sharing - content type isolation', () => {
  test('shows only granted content types from a shared library', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('library', 'movie', { canRead: true })]);
    const movieTitle = 'Shared Movie Only';
    const seriesTitle = 'Hidden Shared Series';
    await shareHelpers.seedOwnerItem(owner, {
      title: movieTitle,
      contentType: 'movie',
      externalId: uniqueImdbId(),
    });
    await shareHelpers.seedOwnerItem(owner, {
      title: seriesTitle,
      contentType: 'series',
      externalId: uniqueImdbId(),
    });

    await visitSharedList(sharedUser);

    const libraryItemsResponse = waitForResponse('GET', '/api/v1/collection-items');
    await collectionPage.visit();
    const response = await libraryItemsResponse;
    expect(response.request().url()).toContain('listType=library');
    const body = (await response.json()) as CollectionPageEnvelope<{ title: string; contentType: string }>;
    expect(body.data.some((item) => item.title === movieTitle)).toBe(true);
    expect(body.data.some((item) => item.title === seriesTitle)).toBe(false);

    await expect(collectionPage.getListItemByTitle(movieTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(seriesTitle)).toHaveCount(0);
  });
});

test.describe('Collection sharing - non-library lists', () => {
  test('shares wishlist items with CRUD when wishlist grant is present', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([
      grant('wishlist', 'movie', { canRead: true, canCreate: true, canUpdate: true, canDelete: true }),
    ]);
    const title = 'Shared Wishlist Movie';
    const imdbId = uniqueImdbId();
    await shareHelpers.seedOwnerItem(owner, {
      title,
      contentType: 'movie',
      listType: 'wishlist',
      externalId: imdbId,
    });

    // Library has no grant: shared wishlist item must not appear on library.
    await visitSharedList(sharedUser, 'library');
    await expect(collectionPage.getEmptyState()).toBeVisible();

    await visitSharedList(sharedUser, 'wishlist');
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toBeVisible();

    const updateWishlistItemResponse = waitForResponse('PUT', '/api/v1/collection-items/');
    await collectionPage.getListItemImages().first().click();
    await assertDialogPermissions({ update: true, delete: true });
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Shared Wishlist Updated');
    page.once('dialog', (dialog) => dialog.accept());
    await collectionPage.getItemDialogSaveButton().click();
    const response = await updateWishlistItemResponse;
    expect(response.status()).toBe(200);
    expect(response.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(response.request().url()).toContain('listType=wishlist');
    await expect(collectionPage.getListItemByTitle('Shared Wishlist Updated')).toBeVisible();
  });

  test('does not expose wishlist items when only library grant exists', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('library', 'movie', { canRead: true })]);
    const title = 'Private Wishlist Movie';
    await shareHelpers.seedOwnerItem(owner, {
      title,
      contentType: 'movie',
      listType: 'wishlist',
      externalId: uniqueImdbId(),
    });

    await visitSharedList(sharedUser, 'wishlist');
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('shares books list create and read', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([
      grant('books', 'book', { canRead: true, canCreate: true }),
    ]);
    const title = 'Shared Owned Book';
    await shareHelpers.seedOwnerItem(owner, {
      title,
      contentType: 'book',
      listType: 'books',
      externalId: '9780306406157',
    });

    await visitSharedList(sharedUser, 'books');
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toBeVisible();

    // Create target available for books grant.
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await expect
      .poll(() => collectionPage.getNewItemLibrarySelect().locator('option').count())
      .toBeGreaterThanOrEqual(2);
    await collectionPage.getNewItemLibrarySelect().selectOption(owner.shareCode);
    await expect(collectionPage.getNewItemLibrarySelect()).toHaveValue(owner.shareCode);
  });

  test('marks shared books completed and uncompleted from tracker management', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('books', 'book', { canRead: true })]);
    await shareHelpers.seedOwnerItem(owner, {
      title: 'Shared Bulk Book',
      contentType: 'book',
      listType: 'books',
      externalId: '9780140328721',
    });

    await shareHelpers.signInThroughUi(sharedUser);
    await settingsPage.visitManageTrackerData();
    await settingsPage.getManageTrackerLibrarySelect().selectOption(owner.shareCode);
    page.on('dialog', (dialog) => dialog.accept());

    const markSharedBooksCompletedResponse = waitForResponse(
      'POST',
      '/api/v1/collection-items/actions/mark-books-completed'
    );
    await expect(settingsPage.getMarkAllBooksCompletedButton()).toBeEnabled();
    await settingsPage.getMarkAllBooksCompletedButton().click();
    const completedResponse = await markSharedBooksCompletedResponse;
    expect(completedResponse.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(completedResponse.status()).toBe(200);

    const markSharedBooksUncompletedResponse = waitForResponse(
      'POST',
      '/api/v1/collection-items/actions/mark-books-uncompleted'
    );
    await expect(settingsPage.getMarkAllBooksUncompletedButton()).toBeEnabled();
    await settingsPage.getMarkAllBooksUncompletedButton().click();
    const uncompletedResponse = await markSharedBooksUncompletedResponse;
    expect(uncompletedResponse.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(uncompletedResponse.status()).toBe(200);
  });

  test('allows editing shared tracking progress with tracking update grant', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([
      grant('tracking', 'movie', { canRead: true, canUpdate: true }),
    ]);
    const title = 'Shared Tracking Movie';
    const imdbId = uniqueImdbId();
    await shareHelpers.seedOwnerItem(owner, {
      title,
      contentType: 'movie',
      listType: 'tracking',
      externalId: imdbId,
    });

    await visitSharedList(sharedUser, 'tracking');
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toBeVisible();

    const updateTrackingResponse = waitForResponse('PUT', '/api/v1/collection-items/');
    await collectionPage.getListItemImages().first().click();
    await assertDialogPermissions({ update: true, delete: false });
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Shared Tracking Renamed');
    page.once('dialog', (dialog) => dialog.accept());
    await collectionPage.getItemDialogSaveButton().click();
    const response = await updateTrackingResponse;
    expect(response.status()).toBe(200);
    expect(response.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(response.request().url()).toContain('listType=tracking');

    // Owner row updated (shared tracking, not a copy).
    const ownerItemsResponse = await shareHelpers.requestAs(
      owner,
      'GET',
      '/api/v1/collection-items?listType=tracking&limit=50'
    );
    const ownerItems = (await ownerItemsResponse.json()) as CollectionPageEnvelope<{ title: string }>;
    expect(ownerItems.data.some((item) => item.title === 'Shared Tracking Renamed')).toBe(true);
  });
});

test.describe('Collection sharing - shared list filter', () => {
  test('filters library list by mine / shared / all via URL and float actions', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('library', 'movie', { canRead: true })]);
    const ownTitle = 'My Own Movie';
    const sharedTitle = 'Shared Filter Movie';
    const ownImdb = uniqueImdbId();
    const sharedImdb = uniqueImdbId();

    await shareHelpers.seedOwnerItem(owner, { title: sharedTitle, externalId: sharedImdb });
    await shareHelpers.seedOwnerItem(sharedUser, { title: ownTitle, externalId: ownImdb });

    await shareHelpers.signInThroughUi(sharedUser);
    const allItemsResponse = waitForResponse('GET', '/api/v1/collection-items');
    await collectionPage.visit();
    let response = await allItemsResponse;
    expect(response.request().url()).not.toContain('shared=');
    let body = (await response.json()) as CollectionPageEnvelope<{ title: string }>;
    let titles = body.data.map((item) => item.title);
    expect(titles).toContain(ownTitle);
    expect(titles).toContain(sharedTitle);
    await expect(collectionPage.getListItemByTitle(ownTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(sharedTitle)).toBeVisible();
    await expect.poll(() => collectionPage.getSharedBadges().count()).toBeGreaterThanOrEqual(1);

    const mineItemsResponse = waitForResponse('GET', 'shared=mine');
    await openFloatFilters();
    await collectionPage.getCollectionFilterButton('sharedMine').click();
    response = await mineItemsResponse;
    expect(response.request().url()).toContain('shared=mine');
    body = (await response.json()) as CollectionPageEnvelope<{ title: string }>;
    titles = body.data.map((item) => item.title);
    expect(titles).toContain(ownTitle);
    expect(titles).not.toContain(sharedTitle);
    await expect(collectionPage.getListItemByTitle(ownTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(sharedTitle)).toHaveCount(0);
    await expect(collectionPage.getSharedBadges()).toHaveCount(0);

    const sharedItemsResponse = waitForResponse('GET', 'shared=shared');
    await openFloatFilters();
    await collectionPage.getCollectionFilterButton('sharedOnly').click();
    response = await sharedItemsResponse;
    expect(response.request().url()).toContain('shared=shared');
    body = (await response.json()) as CollectionPageEnvelope<{ title: string }>;
    titles = body.data.map((item) => item.title);
    expect(titles).toContain(sharedTitle);
    expect(titles).not.toContain(ownTitle);
    await expect(collectionPage.getListItemByTitle(sharedTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(ownTitle)).toHaveCount(0);
    await expect(collectionPage.getSharedBadges()).toHaveCount(1);

    // Direct URL entry also works.
    const urlMineResponse = waitForResponse('GET', '/api/v1/collection-items');
    await collectionPage.visitLibraryWithSharedFilter('mine');
    expect((await urlMineResponse).request().url()).toContain('shared=mine');
  });

  test('hides shared filters when user has no incoming readable grants', async () => {
    const solo = await shareHelpers.createUser('solo');
    await shareHelpers.seedOwnerItem(solo, { title: 'Solo Movie', externalId: uniqueImdbId() });
    await shareHelpers.signInThroughUi(solo);
    await collectionPage.visit();
    await openFloatFilters();
    await expect(page.getByTestId('collection-filter-sharedMine')).toHaveCount(0);
    await expect(page.getByTestId('collection-filter-sharedOnly')).toHaveCount(0);
  });
});

test.describe('Collection sharing - image refresh', () => {
  test('refreshes images for a shared library with update permission', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: true, canDelete: false })
    );
    await shareHelpers.seedOwnerItem(owner, { title: 'Shared Image Refresh Movie', externalId: uniqueImdbId() });
    await shareHelpers.signInThroughUi(sharedUser);
    await settingsPage.visitMediaRefresh();

    await expect(settingsPage.getMediaRefreshLibrarySelect()).toBeVisible();
    await settingsPage.getMediaRefreshLibrarySelect().selectOption(owner.shareCode);
    const refreshImagesResponse = waitForResponse('POST', '/api/v1/collection-items/actions/refresh-images');
    page.on('dialog', (dialog) => dialog.accept());
    await settingsPage.getImageRefreshStartButton().click();

    const response = await refreshImagesResponse;
    expect(response.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(response.status()).toBe(200);
  });

  test('does not offer shared library for refresh without update grant', async () => {
    const { sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })
    );
    await shareHelpers.signInThroughUi(sharedUser);
    await settingsPage.visitMediaRefresh();
    await expect(settingsPage.findMediaRefreshLibrarySelect()).toHaveCount(0);
    // Own library path still present via start button without select when no shared update options.
    await expect(settingsPage.getImageRefreshStartButton()).toBeVisible();
  });
});

test.describe('Collection sharing - tracking dual path', () => {
  test('copies a shared library movie into the viewer own tracking when marked watched', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare(
      libraryMovieSeriesGrants({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })
    );
    const title = 'Shared Tracker Movie';
    const imdbId = uniqueImdbId();
    await shareHelpers.seedOwnerItem(owner, { title, externalId: imdbId });
    await visitSharedList(sharedUser);

    const markWatchedResponse = waitForResponse('POST', '/tracking');
    page.on('dialog', (dialog) => dialog.accept());

    await collectionPage.getListItemByTitle(title).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogMarkFinishedButton().click();

    const watchedResponse = await markWatchedResponse;
    expect(watchedResponse.request().url()).toContain(`ownerShareCode=${encodeURIComponent(owner.shareCode)}`);
    expect(watchedResponse.status()).toBe(200);

    const getTrackingItemsResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/api/v1/collection-items?') &&
        response.url().includes('listType=tracking')
    );
    await collectionPage.visitTracking();
    const response = await getTrackingItemsResponse;
    const body = (await response.json()) as CollectionPageEnvelope<{ title: string; ownerShareCode?: string }>;
    const trackingItem = body.data.find((item) => item.title === title);
    expect(trackingItem, 'viewer owns tracking twin').toBeDefined();
    // Mapper always includes a share code. It must identify the viewer, not source owner.
    expect(trackingItem?.ownerShareCode).toBe(sharedUser.shareCode);
    expect(trackingItem?.ownerShareCode).not.toBe(owner.shareCode);
    await expect(collectionPage.getListItemByTitle(title)).toBeVisible();
    await expect(collectionPage.getSharedBadges()).toHaveCount(0);
  });
});
