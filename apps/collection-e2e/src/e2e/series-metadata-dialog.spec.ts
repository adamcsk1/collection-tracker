import type { Page, Response } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { expect, test } from '../support/test';

let collectionPage: ReturnType<typeof createCollectionPage>;

test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
});

const getTrackingItemsResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/collection-items?') &&
      response.url().includes('listType=tracking')
  );

const waitForTrackingItem = async (responsePromise: Promise<Response>, imdbId: string) => {
  const response = await responsePromise;
  const body = (await response.json()) as { data: Array<{ IMDbId: string }> };
  expect(body.data.some((item) => item.IMDbId === imdbId)).toBe(true);
};

test.describe('Series metadata dialog', () => {
  const imdbId = 'tt8300001';
  const seriesTitle = 'Metadata Dialog Test Show';

  test.beforeEach(async ({ page, autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(seriesTitle, 'series', imdbId),
      listType: 'tracking',
    });
    const responsePromise = getTrackingItemsResponse(page);
    await collectionPage.visitTracking();
    await waitForTrackingItem(responsePromise, imdbId);
  });

  test('saves manual season metadata', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getSeriesMetadataRefreshButton()).toBeVisible();

    await expect(collectionPage.getSeriesMetadataMessage()).toContainText(
      'Season and episode counts can come from the configured external metadata provider'
    );
    await collectionPage.getSeriesMetadataAddButton().click();
    await collectionPage.getSeriesMetadataAddButton().click();

    await collectionPage.getSeriesMetadataEpisodeInputs().nth(0).fill('0');
    await expect(collectionPage.getSeriesMetadataValidation()).toBeVisible();
    await expect(collectionPage.getSeriesMetadataSaveButton()).toBeDisabled();

    await collectionPage.getSeriesMetadataEpisodeInputs().nth(0).fill('3');
    await collectionPage.getSeriesMetadataEpisodeInputs().nth(1).fill('2');
    await expect(collectionPage.getSeriesMetadataValidation()).toHaveCount(0);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataSaveButton().click();

    expect((await responsePromise).status()).toBe(200);
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogManageSeriesMetadataButton()).toBeVisible();
  });

  test('removes stored season metadata', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });
    page.on('dialog', (dialog) => dialog.accept());

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    await expect(collectionPage.getCompletedEpisodesDialog()).toBeVisible();
    await expect(collectionPage.getCompletedEpisodesNoMetadataMessage()).toHaveCount(0);
    await collectionPage.closeActiveDialogByOverlay();

    await expect(page.getByTestId('completed-episodes-dialog')).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataRemoveAllButton().click();

    expect((await responsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await expect(collectionPage.getCompletedEpisodesNoMetadataMessage()).toBeVisible();
  });

  test('saves and restores episode titles in the metadata dialog', async ({ page }) => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();

    await collectionPage.getSeriesMetadataAddButton().click();
    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('2');

    await collectionPage.getSeriesMetadataEpisodeTitleToggles().first().click();
    await collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(0).fill('Alpha');
    await collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(1).fill('Beta');

    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataSaveButton().click();
    expect((await responsePromise).status()).toBe(200);

    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();

    await collectionPage.getSeriesMetadataEpisodeTitleToggles().first().click();
    await expect(collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(0)).toHaveValue('Alpha');
    await expect(collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(1)).toHaveValue('Beta');
  });

  test('shows no-metadata message when no metadata is set', async () => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();

    await expect(collectionPage.getSeriesMetadataNoMetadataMessage()).toBeVisible();
  });
});
