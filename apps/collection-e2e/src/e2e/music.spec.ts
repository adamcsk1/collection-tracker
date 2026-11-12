import type { Page } from '@playwright/test';
import { buildMusicBrainzItem, buildMusicBrainzSearchResult, buildMusicItem } from '../fixtures/musicbrainz';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { createMusicPage } from '../page-objects/music.po';
import { createSettingsPage } from '../page-objects/settings.po';
import { expect, test } from '../support/test';

let collectionPage: ReturnType<typeof createCollectionPage>;
let commonPage: ReturnType<typeof createCommonPage>;
let musicPage: ReturnType<typeof createMusicPage>;
let settingsPage: ReturnType<typeof createSettingsPage>;

test.beforeEach(async ({ page }) => {
  collectionPage = createCollectionPage(page);
  commonPage = createCommonPage(page);
  musicPage = createMusicPage(page);
  settingsPage = createSettingsPage(page);
});

const waitForApiResponse = (page: Page, method: string, urlPart: string) =>
  page.waitForResponse((response) => response.request().method() === method && response.url().includes(urlPart));

test.describe('Music', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('toggles music filter while keeping the direct route accessible', async ({ page }) => {
    await collectionPage.visit();
    await page.getByTestId('show-functions').click();
    await expect(collectionPage.getMediaChip('album')).toBeVisible();

    await settingsPage.visitFeatures();
    let saveSettingsResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureMusicCheckbox().setChecked(false);
    expect((await saveSettingsResponsePromise).status()).toBe(200);

    await collectionPage.visit();
    await expect(collectionPage.getMediaChip('album')).toHaveCount(0);
    await commonPage.openMenu();
    await expect(commonPage.getMenuNavItem('nav-music')).toHaveCount(0);
    await commonPage.closeMenu();

    await musicPage.visit();
    await expect(page).toHaveURL(/#\/collection\/music/);
    await expect(musicPage.getEmptyState()).toBeVisible();

    await settingsPage.visitFeatures();
    saveSettingsResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/users/me/settings');
    await settingsPage.getFeatureMusicCheckbox().setChecked(true);
    expect((await saveSettingsResponsePromise).status()).toBe(200);
    await collectionPage.visit();
    await expect(collectionPage.getMediaChip('album')).toBeVisible();
  });

  test('searches MusicBrainz, creates an album, shows its details, and deletes it', async ({ page }) => {
    const title = 'The E2E Album';
    const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';
    await page.route('**/api/v1/external-metadata/search*provider=musicbrainz*', async (route) => {
      await route.fulfill({ status: 200, json: { data: buildMusicBrainzSearchResult(title, mbid) } });
    });
    await page.route('**/api/v1/external-metadata/items*externalIdentitySource=musicbrainz*', async (route) => {
      await route.fulfill({ status: 200, json: { data: buildMusicBrainzItem(title, mbid) } });
    });

    await musicPage.visit();
    await musicPage.getAddFirstItemLink().click();
    const musicBrainzSearchResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/search');
    await musicPage.getNewItemSearchInput().fill(title);
    await musicBrainzSearchResponsePromise;
    await expect(musicPage.getNewItemContentOptions()).toHaveCount(1);
    await expect(musicPage.getNewItemContentOptions()).toContainText([title]);

    const musicBrainzItemResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/external-metadata/items');
    const createAlbumResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await musicPage.getNewItemSaveAndCloseButton().click();
    await musicBrainzItemResponsePromise;
    const createAlbumResponse = await createAlbumResponsePromise;
    expect(createAlbumResponse.request().postDataJSON()).toMatchObject({
      title,
      contentType: 'album',
      externalProvider: 'musicbrainz',
      externalItemId: mbid,
      listType: 'music',
      actors: 'Artist One, Artist Two',
    });
    expect(createAlbumResponse.request().postDataJSON().externalIds).toEqual([{ source: 'musicbrainz', id: mbid }]);
    expect(createAlbumResponse.status()).toBe(200);

    await expect(musicPage.getListItemTitles()).toHaveCount(1);
    await expect(musicPage.getListItemTitles()).toContainText([title]);
    await musicPage.getListItemImages().first().click();
    await expect(musicPage.getItemDialog()).toContainText(title);
    await expect(musicPage.getItemDialog()).toContainText('Artist One, Artist Two');
    await expect(musicPage.getItemDialogMbid()).toContainText(mbid);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const deleteAlbumResponsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/');
    await musicPage.getItemDialogDeleteButton().click();
    expect((await deleteAlbumResponsePromise).status()).toBe(204);
    await expect(musicPage.getEmptyState()).toBeVisible();
  });

  test('adds a music list item manually by MBID and persists it after reload', async ({ page }) => {
    const title = 'Manual E2E Album';
    const mbid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const artists = 'Manual Artist';

    await musicPage.visit();
    await musicPage.getShowFunctionsButton().click();
    await musicPage.getAddNewButton().click();

    await musicPage.getNewItemManualModeButton().click();
    await musicPage.getNewItemManualTitleInput().fill(title);
    await musicPage.getNewItemManualMbidInput().fill(mbid);
    await musicPage.getNewItemManualArtistsInput().fill(artists);
    await expect(musicPage.getNewItemSaveAndCloseButton()).toBeEnabled();
    const createManualAlbumResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/collection-items');
    await musicPage.getNewItemSaveAndCloseButton().click();

    const createManualAlbumResponse = await createManualAlbumResponsePromise;
    expect(createManualAlbumResponse.request().postDataJSON()).toMatchObject({
      title,
      contentType: 'album',
      externalProvider: 'musicbrainz',
      externalItemId: mbid,
      listType: 'music',
      actors: artists,
      favorite: false,
    });
    expect(createManualAlbumResponse.request().postDataJSON().externalIds).toEqual([
      { source: 'musicbrainz', id: mbid },
    ]);
    expect(createManualAlbumResponse.status()).toBe(200);

    await expect(musicPage.getListItemTitles()).toHaveCount(1);
    await expect(musicPage.getListItemTitles()).toContainText([title]);
    await musicPage.getListItemImages().first().click();
    await expect(musicPage.getItemDialog()).toContainText(title);
    await expect(musicPage.getItemDialog()).toContainText(artists);
    await expect(musicPage.getItemDialogMbid()).toContainText(mbid);

    const reloadMusicResponsePromise = waitForApiResponse(page, 'GET', '/api/v1/collection-items');
    await page.reload();
    await reloadMusicResponsePromise;
    await expect(musicPage.getListItemTitles()).toHaveCount(1);
    await expect(musicPage.getListItemTitles()).toContainText([title]);
  });

  test('keeps manual album save disabled for invalid MBID or missing required fields', async () => {
    await musicPage.visit();
    await musicPage.getShowFunctionsButton().click();
    await musicPage.getAddNewButton().click();

    await musicPage.getNewItemManualModeButton().click();
    await musicPage.getNewItemManualTitleInput().fill('Manual Album Title');
    await expect(musicPage.getNewItemSaveAndCloseButton()).toBeDisabled();

    await musicPage.getNewItemManualMbidInput().fill('not-an-mbid');
    await expect(musicPage.getNewItemSaveAndCloseButton()).toBeDisabled();

    await musicPage.getNewItemManualMbidInput().fill('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    await expect(musicPage.getNewItemSaveAndCloseButton()).toBeEnabled();
  });

  test('clears all music list data from manage tracker data settings', async ({ api, page }) => {
    const createAlbumResponse = await api.request('POST', '/api/v1/collection-items', buildMusicItem('Album To Clear'));
    expect(createAlbumResponse.status()).toBe(200);
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await settingsPage.visitManageTrackerData();
    const clearMusicResponsePromise = waitForApiResponse(page, 'DELETE', '/api/v1/collection-items/music');
    await settingsPage.getRemoveAllTrackedMusicDataButton().click();
    expect((await clearMusicResponsePromise).status()).toBe(200);

    await musicPage.visit();
    await expect(musicPage.getEmptyState()).toBeVisible();
  });
});
