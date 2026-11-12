import type { Page, Response } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { expect, test } from '../support/test';

let collectionPage: ReturnType<typeof createCollectionPage>;

test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
  page.on('dialog', (dialog) => dialog.accept());
});

const getTrackingItemsResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/collection-items?') &&
      response.url().includes('listType=tracking')
  );

const getCompletedEpisodesResponse = (page: Page) =>
  page.waitForResponse(
    (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/completed-episodes')
  );

const waitForTrackingItem = async (responsePromise: Promise<Response>, imdbId: string) => {
  const response = await responsePromise;
  const body = (await response.json()) as { data: Array<{ IMDbId: string }> };
  expect(body.data.some((item) => item.IMDbId === imdbId)).toBe(true);
};

test.describe('Completed episodes dialog', () => {
  const imdbId = 'tt8300002';
  const seriesTitle = 'Completed Episodes Test Show';

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

  test('opens dialog and shows no-metadata message when no metadata exists', async () => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    await expect(collectionPage.getCompletedEpisodesNoMetadataMessage()).toBeVisible();
    await expect(collectionPage.getCompletedEpisodesManageSeasonMetadataButton()).toBeVisible();
  });

  test('opens dialog and shows episodes when metadata exists', async ({ api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    await expect(collectionPage.getCompletedEpisodesNoMetadataMessage()).toHaveCount(0);
    await expect(collectionPage.getCompletedEpisodesSeasonToggle()).toHaveCount(2);
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox()).toHaveCount(5);
  });

  test('checks individual episodes and saves', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    const firstSaveResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0).check();
    expect((await firstSaveResponsePromise).status()).toBe(200);
    const secondSaveResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(1).check();
    expect((await secondSaveResponsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E02');
  });

  test('uses season toggle to mark all episodes completed', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    const responsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesSeasonToggle().first().check();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0)).toBeChecked();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(1)).toBeChecked();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(2)).toBeChecked();

    expect((await responsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E03');
  });

  test('unchecks episodes and saves', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`, {
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
        { season: 1, episode: 3 },
      ],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(2)).toBeChecked();
    await collectionPage.getCompletedEpisodesSeasonSummaries().first().click();
    const responsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(2).uncheck();

    expect((await responsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E02');
  });

  test('persists completed episodes across dialog re-opens', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    const responsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0).check();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();

    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0)).toBeChecked();
  });

  test('updates the item dialog after closing while auto-save is pending', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await page.route('**/api/v1/collection-items/*/*/tracking/completed-episodes*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.continue();
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    const responsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesEpisodeCheckbox().nth(0).check();
    await collectionPage.closeDialogByOverlay();
    expect((await responsePromise).status()).toBe(200);

    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E01');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(page.getByTestId('item-dialog')).toHaveCount(0);
    await expect(page.locator('.dialog')).toHaveCount(0);
  });

  test('marks all episodes completed from the manage episodes dialog and updates completed filters', async ({
    page,
    api,
  }) => {
    const incompleteImdbId = 'tt8300003';
    const incompleteSeriesTitle = 'Incomplete Episodes Test Show';
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(incompleteSeriesTitle, 'series', incompleteImdbId),
      listType: 'tracking',
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${incompleteImdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 2 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${incompleteImdbId}/tracking/completed-episodes`, {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });

    const reloadResponsePromise = getTrackingItemsResponse(page);
    await page.reload();
    await waitForTrackingItem(reloadResponsePromise, imdbId);
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await collectionPage.expectItemDialogActionsVisible();
    const markCompletedResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesMarkAllCompletedButton().click();
    expect((await markCompletedResponsePromise).status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E02');
    await collectionPage.closeDialogByOverlay();
    await expect(page.getByTestId('item-dialog')).toHaveCount(0);
    await expect(page.locator('.dialog')).toHaveCount(0);

    await collectionPage.visitTracking();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('completed').click();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItems()).toContainText(seriesTitle);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('uncompleted').click();
    await expect(collectionPage.getListItems()).toHaveCount(1);
    await expect(collectionPage.getListItems()).toContainText(incompleteSeriesTitle);

    await collectionPage.visitTracking();
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getCompletedEpisodesMarkAllCompletedButton()).toHaveCount(0);
    const markUncompletedResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesMarkAllUncompletedButton().click();
    const markUncompletedResponse = await markUncompletedResponsePromise;
    expect(markUncompletedResponse.request().postDataJSON()).toEqual({ completedEpisodes: [] });
    expect(markUncompletedResponse.status()).toBe(200);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('N/A');
    await collectionPage.closeDialogByOverlay();
    await expect(page.getByTestId('item-dialog')).toHaveCount(0);
    await expect(page.locator('.dialog')).toHaveCount(0);

    const finalVisitResponsePromise = getTrackingItemsResponse(page);
    await page.reload();
    await waitForTrackingItem(finalVisitResponsePromise, imdbId);
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getCollectionFilterButton('uncompleted').click();
    await expect(collectionPage.getListItems()).toHaveCount(2);
  });

  test('removes stale completed episodes when season metadata is reduced', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`, {
      completedEpisodes: [
        { season: 1, episode: 1 },
        { season: 1, episode: 3 },
      ],
    });

    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 1 }],
    });

    const responsePromise = getTrackingItemsResponse(page);
    await page.reload();
    await waitForTrackingItem(responsePromise, imdbId);
    await expect(collectionPage.getTrackingCompletedBadges()).toHaveCount(1);
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await expect(collectionPage.getItemDialogEpisodeProgressChip()).toContainText('S01E01');

    const completedEpisodesResponse = await api.request(
      'GET',
      `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`
    );
    const body = (await completedEpisodesResponse.json()) as {
      data: { completedEpisodes: Array<{ season: number; episode: number }> };
    };
    expect(body.data.completedEpisodes).toEqual([{ season: 1, episode: 1 }]);
  });
});
