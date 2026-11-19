import sharp from 'sharp';
import { buildOmdbItem } from '../fixtures/omdb';
import { createCollectionPage } from '../page-objects/collection.po';
import { createPhotoImportDialog } from '../page-objects/photo-import.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { expect, test } from '../support/test';

test('reuses normal Add poster cards for photo review on desktop and mobile', async ({ page, autoLogin }, testInfo) => {
  const results = [
    { ...buildOmdbItem('The Matrix', 'tt0133093'), poster: '' },
    { ...buildOmdbItem('The Matrix Reloaded', 'tt0234215'), poster: '' },
    { ...buildOmdbItem('The Matrix Revolutions', 'tt0242653'), poster: '' },
  ];
  await page.route('**/api/v1/ai/availability', (route) => route.fulfill({ json: { data: { aiAvailable: false } } }));
  await page.route('**/api/v1/ai/vision/availability', (route) =>
    route.fulfill({ json: { data: { available: true, reason: 'available' } } })
  );
  await page.route('**/api/v1/external-metadata/search*', (route) => route.fulfill({ json: { data: { results } } }));
  await page.route('**/api/v1/ai/vision/recognize', (route) =>
    route.fulfill({
      json: { data: { titles: [{ title: 'The Matrix' }, { title: 'The Matrix Reloaded' }] } },
    })
  );
  await autoLogin();
  const collection = createCollectionPage(page);
  const photoDialog = createPhotoImportDialog(page);
  await collection.openNewItemDialog();
  await collection.getNewItemSearchInput().fill('The Matrix');
  await collection.getNewItemSearchInput().press('Enter');
  const normalOptions = collection.getNewItemContentOptions();
  await expect(normalOptions).toHaveCount(3);
  await expect(normalOptions.first()).toHaveAttribute('aria-pressed', 'true');
  const normalCardWidth = await normalOptions.first().evaluate((element) => element.getBoundingClientRect().width);
  await photoDialog.open();
  await expect(photoDialog.getFromPhotosButton()).toHaveAttribute('role', 'tab');
  await expect(page.getByTestId('dialog-frame')).toHaveCount(1);
  await expect(page.getByTestId('photo-import-done')).toHaveCount(0);
  await expect(collection.getNewItemSaveAndCloseButton()).toHaveCount(0);
  await expect(photoDialog.getContentTypeSelect()).toBeEnabled();
  await expect(photoDialog.getLibrarySelect()).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('photo-tab-setup-desktop.png'), animations: 'disabled' });
  const buffer = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#587340' } })
    .jpeg()
    .toBuffer();
  await photoDialog.uploadPhotos({ name: 'covers.jpg', mimeType: 'image/jpeg', buffer });
  await expect(photoDialog.getContentTypeSelect()).toBeDisabled();
  await expect(photoDialog.getLibrarySelect()).toBeDisabled();
  await photoDialog.readPhotos();
  await expect(photoDialog.getRows()).toHaveCount(2);
  const firstMatches = photoDialog.getMatchButtons(0);
  await expect(firstMatches).toHaveCount(3);
  await expect(firstMatches.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(photoDialog.getAddButton()).toBeDisabled();
  expect(await firstMatches.first().evaluate((element) => element.getBoundingClientRect().width)).toBe(normalCardWidth);
  await firstMatches.first().focus();
  await firstMatches.first().press('Enter');
  await expect(firstMatches.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(photoDialog.getMatchButtons(1).first()).toBeDisabled();
  await expect(photoDialog.getAddButton()).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('shared-results-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(firstMatches.first()).toBeVisible();
  await expect(photoDialog.getMatchButtons(1).first()).toBeDisabled();
  const matchLists = photoDialog.getDialogHost().getByTestId('photo-import-options');
  for (const list of await matchLists.all()) {
    expect(await list.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  }
  expect(await photoDialog.getDialog().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shared-results-mobile.png'), animations: 'disabled' });
  const message = createMessageDialog(page);
  await collection.getNewItemSearchModeButton().press('Enter');
  await expect(message.getDialog()).toBeVisible();
  await message.cancel();
  await expect(photoDialog.getFromPhotosButton()).toHaveAttribute('aria-selected', 'true');
  await expect(photoDialog.getFromPhotosButton()).toBeFocused();
  await expect(firstMatches.first()).toHaveAttribute('aria-pressed', 'true');
  await collection.getNewItemSearchModeButton().press('Enter');
  await message.confirm();
  await expect(photoDialog.getDialogHost()).toHaveCount(0);
  await expect(collection.getNewItemSearchModeButton()).toHaveAttribute('aria-selected', 'true');
  await expect(collection.getNewItemSearchInput()).toHaveValue('The Matrix');
  await expect(collection.getNewItemSaveAndCloseButton()).toBeVisible();
});

test('keeps the photo tab accessible when vision is unavailable without affecting normal drafts', async ({
  page,
  autoLogin,
}, testInfo) => {
  await page.route('**/api/v1/ai/availability', (route) => route.fulfill({ json: { data: { aiAvailable: false } } }));
  await page.route('**/api/v1/ai/vision/availability', (route) =>
    route.fulfill({ json: { data: { available: false, reason: 'not-configured' } } })
  );
  await autoLogin();
  await page.setViewportSize({ width: 390, height: 844 });
  const collection = createCollectionPage(page);
  const photos = createPhotoImportDialog(page);
  await collection.openNewItemDialog();
  await collection.getNewItemManualModeButton().click();
  await collection.getNewItemManualTitleInput().fill('Manual draft');
  await photos.getFromPhotosButton().click();
  await expect(photos.getFromPhotosButton()).toHaveAttribute('aria-selected', 'true');
  await expect(photos.getAvailabilityStatus()).toContainText('ollama-vision.config.json');
  await expect(photos.getChooseButton()).toBeDisabled();
  await photos.getContentTypeSelect().selectOption('series');
  expect(await photos.getDialog().evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('photo-tab-unavailable-mobile.png'), animations: 'disabled' });
  await photos.getFromPhotosButton().press('ArrowLeft');
  await expect(collection.getNewItemManualModeButton()).toBeFocused();
  await expect(collection.getNewItemManualTitleInput()).toHaveValue('Manual draft');
  await collection.getNewItemManualModeButton().press('End');
  await expect(photos.getFromPhotosButton()).toBeFocused();
  await expect(photos.getContentTypeSelect()).toHaveValue('movie');
  await photos.getFromPhotosButton().press('Home');
  await expect(collection.getNewItemSearchModeButton()).toBeFocused();
});
