import type { Page } from '@playwright/test';
import { createCollectionPage } from '../page-objects/collection.po';
import { createItemSharingDialog } from '../page-objects/item-sharing.po';
import { createSettingsPage } from '../page-objects/settings.po';
import type { ApiEnvelope, ItemShareState, OutgoingShareResponse, TestUser } from '../support/share-helper-model';
import {
  createShareHelpers,
  expectGrant,
  expectItemShare,
  expectNoGrant,
  grant,
  uniqueImdbId,
} from '../support/share-helpers';
import { expect, test } from '../support/test';

let page: Page;
let collectionPage: ReturnType<typeof createCollectionPage>;
let itemSharingDialog: ReturnType<typeof createItemSharingDialog>;
let settingsPage: ReturnType<typeof createSettingsPage>;
let shareHelpers: ReturnType<typeof createShareHelpers>;

const waitForResponse = (method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

const visitList = async (user: TestUser, listType: 'library' | 'books' = 'library'): Promise<void> => {
  await shareHelpers.signInThroughUi(user);
  const responsePromise = waitForResponse('GET', '/api/v1/collection-items');
  if (listType === 'books') await collectionPage.visitBooks();
  else await collectionPage.visit();
  await responsePromise;
};

const openItemShare = async (title: string): Promise<void> => {
  await collectionPage.getListItemByTitle(title).click();
  await collectionPage.getItemDialogShareButton().click();
  await expect(itemSharingDialog.getDialog()).toBeVisible();
};

const saveItemShareDialog = async (): Promise<void> => {
  const responsePromise = waitForResponse('PUT', '/shares?');
  await itemSharingDialog.getSaveButton().click();
  expect((await responsePromise).status()).toBe(204);
  await expect(itemSharingDialog.getDialogHost()).toHaveCount(0);
};

const itemIdentity = (externalItemId: string, listType: 'library' | 'books' = 'library') => ({
  externalProvider: listType === 'books' ? 'openlibrary' : 'omdb',
  externalItemId,
  listType,
});

test.beforeEach(async ({ page: currentPage, api }) => {
  page = currentPage;
  collectionPage = createCollectionPage(page);
  itemSharingDialog = createItemSharingDialog(page);
  settingsPage = createSettingsPage(page);
  shareHelpers = createShareHelpers(page, api);
});

test.afterEach(async () => {
  await shareHelpers.cleanupCreatedUsers();
});

test.describe('Individual item sharing - selection lifecycle', () => {
  test('creates first scope permissions, reuses them, and clears them after last removal', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('wishlist', 'movie')], { prefix: 'isl' });
    const firstId = uniqueImdbId();
    const secondId = uniqueImdbId();
    const firstTitle = 'Individually Shared First';
    const updatedFirstTitle = 'Individually Shared Updated';
    const secondTitle = 'Individually Shared Second';
    await shareHelpers.seedOwnerItem(owner, { title: firstTitle, externalId: firstId });
    await shareHelpers.seedOwnerItem(owner, { title: secondTitle, externalId: secondId });

    await visitList(owner);
    await openItemShare(firstTitle);
    await expect(itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode)).not.toBeChecked();
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
    await expect(itemSharingDialog.getPermissions(sharedUser.shareCode)).toBeVisible();
    await expect(itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-read')).toBeChecked();
    await expect(itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-read')).toBeDisabled();
    await expect(itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-create')).not.toBeChecked();
    await expect(itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-update')).not.toBeChecked();
    await itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-update').check();
    await expect(itemSharingDialog.getPermissionCheckbox(sharedUser.shareCode, 'can-delete')).not.toBeChecked();
    await saveItemShareDialog();

    await visitList(sharedUser);
    await expect(collectionPage.getListItemByTitle(firstTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(secondTitle)).toHaveCount(0);
    await collectionPage.getListItemByTitle(firstTitle).click();
    await expect(collectionPage.getItemDialogShareButton()).toHaveCount(0);
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill(updatedFirstTitle);
    page.once('dialog', (dialog) => dialog.accept());
    const updateResponse = waitForResponse('PUT', `/api/v1/collection-items/omdb/${firstId}?`);
    await collectionPage.getItemDialogSaveButton().click();
    expect((await updateResponse).status()).toBe(200);
    await expect(collectionPage.getListItemByTitle(updatedFirstTitle)).toBeVisible();

    await visitList(owner);
    await openItemShare(secondTitle);
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
    await expect(itemSharingDialog.getPermissions(sharedUser.shareCode)).toHaveCount(0);
    await saveItemShareDialog();

    await visitList(owner);
    await openItemShare(updatedFirstTitle);
    await expect(itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode)).toBeChecked();
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).uncheck();
    await saveItemShareDialog();

    await visitList(sharedUser);
    await expect(collectionPage.getListItemByTitle(updatedFirstTitle)).toHaveCount(0);
    await expect(collectionPage.getListItemByTitle(secondTitle)).toBeVisible();

    await visitList(owner);
    await openItemShare(secondTitle);
    await expect(itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode)).toBeChecked();
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).uncheck();
    await saveItemShareDialog();

    const sharesResponse = await shareHelpers.requestAs(owner, 'GET', '/api/v1/users/me/shares');
    const shares = (await sharesResponse.json()) as ApiEnvelope<OutgoingShareResponse>;
    const relationship = shares.data.outgoing.find((share) => share.sharedWithUserShareCode === sharedUser.shareCode);
    expect(relationship).toBeDefined();
    expectNoGrant(relationship!.grants, 'library', 'movie');
    expectGrant(relationship!.grants, 'wishlist', 'movie', { canRead: true });
    const itemSharesResponse = await shareHelpers.getItemShares(owner, itemIdentity(secondId));
    const itemShares = (await itemSharesResponse.json()) as ApiEnvelope<ItemShareState[]>;
    expectItemShare(itemShares.data, sharedUser.shareCode, { readMode: 'none', permissions: null });
    await visitList(sharedUser);
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
});

test.describe('Individual item sharing - scope transitions', () => {
  test('confirms selected scope promotion and clearing while preserving cancelled state', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('wishlist', 'movie')], { prefix: 'ist' });
    const selectedId = uniqueImdbId();
    const siblingId = uniqueImdbId();
    const selectedTitle = 'Tri-state Selected';
    const siblingTitle = 'Tri-state Sibling';
    await shareHelpers.seedOwnerItem(owner, { title: selectedTitle, externalId: selectedId });
    await shareHelpers.seedOwnerItem(owner, { title: siblingTitle, externalId: siblingId });
    await shareHelpers.saveItemShares(owner, itemIdentity(selectedId), [
      {
        sharedWithUserShareCode: sharedUser.shareCode,
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);

    await shareHelpers.signInThroughUi(owner);
    const confirmationResults = [false, true, false, true];
    page.on('dialog', async (dialog) => {
      if (confirmationResults.shift() ?? true) await dialog.accept();
      else await dialog.dismiss();
    });
    await settingsPage.visitShares();
    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    const readCheckbox = settingsPage.getOutgoingShareGrantCheckbox('library', 'movie', 'can-read');
    await expect(readCheckbox).toHaveJSProperty('indeterminate', true);
    await readCheckbox.click();
    await settingsPage.closeShareDialogByOverlay();
    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    await expect(readCheckbox).toHaveJSProperty('indeterminate', true);
    await readCheckbox.click();
    await expect(readCheckbox).toBeChecked();
    await expect(readCheckbox).toHaveJSProperty('indeterminate', false);
    const promoteResponse = waitForResponse('POST', '/api/v1/users/me/shares');
    const reloadPromotedResponse = waitForResponse('GET', '/api/v1/users/me/shares');
    await settingsPage.getShareDialogSaveButton().click();
    expect((await promoteResponse).status()).toBe(204);
    expect((await reloadPromotedResponse).status()).toBe(200);

    await visitList(sharedUser);
    await expect(collectionPage.getListItemByTitle(selectedTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(siblingTitle)).toBeVisible();

    await shareHelpers.signInThroughUi(owner);
    await settingsPage.visitShares();
    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    await readCheckbox.uncheck();
    const clearResponse = waitForResponse('POST', '/api/v1/users/me/shares');
    const reloadClearedResponse = waitForResponse('GET', '/api/v1/users/me/shares');
    await settingsPage.getShareDialogSaveButton().click();
    expect((await clearResponse).status()).toBe(204);
    expect((await reloadClearedResponse).status()).toBe(200);
    await visitList(owner);
    await openItemShare(selectedTitle);
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
    const restoreResponse = waitForResponse('PUT', '/shares?');
    await itemSharingDialog.getSaveButton().click();
    const restored = await restoreResponse;
    expect(restored.status()).toBe(204);
    expect(restored.request().postDataJSON().selections).toEqual([
      {
        sharedWithUserShareCode: sharedUser.shareCode,
        permissions: { canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      },
    ]);
    const restoredSharesResponse = await shareHelpers.getItemShares(owner, itemIdentity(selectedId));
    const restoredShares = (await restoredSharesResponse.json()) as ApiEnvelope<ItemShareState[]>;
    expectItemShare(restoredShares.data, sharedUser.shareCode, {
      readMode: 'selected',
      permissions: { canRead: true },
    });
    await expect(itemSharingDialog.getDialogHost()).toHaveCount(0);
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);

    const loadRestoredResponse = waitForResponse('GET', '/api/v1/users/me/shares');
    await settingsPage.visitShares();
    expect((await loadRestoredResponse).status()).toBe(200);
    await settingsPage.getEditShareButton(sharedUser.shareCode).click();
    await expect(readCheckbox).toHaveJSProperty('indeterminate', true);
    await settingsPage.getClearSelectedShareButton('library', 'movie').click();
    await expect(readCheckbox).toHaveJSProperty('indeterminate', true);
    await settingsPage.getClearSelectedShareButton('library', 'movie').click();
    await expect(readCheckbox).not.toBeChecked();
    await expect(readCheckbox).toHaveJSProperty('indeterminate', false);
    const saveClearedResponse = waitForResponse('POST', '/api/v1/users/me/shares');
    await settingsPage.getShareDialogSaveButton().click();
    expect((await saveClearedResponse).status()).toBe(204);

    await visitList(sharedUser);
    await expect(collectionPage.getEmptyState()).toBeVisible();
    const clearedSharesResponse = await shareHelpers.getItemShares(owner, itemIdentity(selectedId));
    const clearedShares = (await clearedSharesResponse.json()) as ApiEnvelope<ItemShareState[]>;
    expectItemShare(clearedShares.data, sharedUser.shareCode, { readMode: 'none', permissions: null });
    expect(confirmationResults).toEqual([]);
  });
});

test.describe('Individual item sharing - selected create', () => {
  test('auto-selects an item created in owner scope only for its creator', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('wishlist', 'movie')], { prefix: 'isc' });
    const otherUser = await shareHelpers.createUser('other', 'isc');
    const shareResponse = await shareHelpers.requestAs(owner, 'POST', '/api/v1/users/me/shares', {
      sharedWithUserShareCode: otherUser.shareCode,
      grants: [grant('wishlist', 'movie')],
    });
    expect(shareResponse.status()).toBe(204);
    const anchorId = uniqueImdbId();
    const createdId = uniqueImdbId();
    const anchorTitle = 'Selected Create Anchor';
    const createdTitle = 'Selected Create Result';
    await shareHelpers.seedOwnerItem(owner, { title: anchorTitle, externalId: anchorId });
    await shareHelpers.saveItemShares(owner, itemIdentity(anchorId), [
      {
        sharedWithUserShareCode: sharedUser.shareCode,
        permissions: { canRead: true, canCreate: true, canUpdate: false, canDelete: false },
      },
    ]);

    await visitList(sharedUser);
    await expect(collectionPage.getListItemByTitle(anchorTitle)).toBeVisible();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().click();
    await collectionPage.getNewItemManualModeButton().click();
    await collectionPage.getNewItemLibrarySelect().selectOption(owner.shareCode);
    await collectionPage.getNewItemManualTitleInput().fill(createdTitle);
    await collectionPage.getNewItemManualImdbIdInput().fill(createdId);
    const createResponse = waitForResponse('POST', '/api/v1/collection-items');
    await expect(collectionPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    await collectionPage.getNewItemSaveAndCloseButton().click();
    const created = await createResponse;
    expect(created.status()).toBe(200);
    expect(created.request().postDataJSON().targetOwnerShareCode).toBe(owner.shareCode);
    await expect(collectionPage.getListItemByTitle(createdTitle)).toBeVisible();
    const itemSharesResponse = await shareHelpers.getItemShares(owner, itemIdentity(createdId));
    const itemShares = (await itemSharesResponse.json()) as ApiEnvelope<ItemShareState[]>;
    expectItemShare(itemShares.data, sharedUser.shareCode, { readMode: 'selected', permissions: { canCreate: true } });
    expectItemShare(itemShares.data, otherUser.shareCode, { readMode: 'none', permissions: null });

    await visitList(otherUser);
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });
});

test.describe('Individual item sharing - physical scope routing', () => {
  test('shares only selected physical book rows through books scope', async () => {
    const { owner, sharedUser } = await shareHelpers.setupShare([grant('wishlist', 'movie')], { prefix: 'isb' });
    const selectedTitle = 'Selected Physical Book';
    const siblingTitle = 'Private Physical Book';
    const selectedIsbn = '9780306406157';
    await shareHelpers.seedOwnerItem(owner, { title: selectedTitle, contentType: 'book', externalId: selectedIsbn });
    await shareHelpers.seedOwnerItem(owner, { title: siblingTitle, contentType: 'book', externalId: '9780140328721' });

    await visitList(owner, 'books');
    await openItemShare(selectedTitle);
    await itemSharingDialog.getRecipientCheckbox(sharedUser.shareCode).check();
    const responsePromise = waitForResponse('PUT', '/shares?');
    await itemSharingDialog.getSaveButton().click();
    const response = await responsePromise;
    expect(response.status()).toBe(204);
    expect(response.request().url()).toContain('/openlibrary/9780306406157/shares');
    expect(response.request().url()).toContain('listType=books');

    await visitList(sharedUser, 'books');
    await expect(collectionPage.getListItemByTitle(selectedTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(siblingTitle)).toHaveCount(0);
    await visitList(sharedUser);
    await expect(collectionPage.getListItemByTitle(selectedTitle)).toBeVisible();
    await expect(collectionPage.getListItemByTitle(siblingTitle)).toHaveCount(0);
  });
});
