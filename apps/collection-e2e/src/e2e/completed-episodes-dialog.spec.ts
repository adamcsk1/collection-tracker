import type { Page, Response } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
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
    await expect(collectionPage.getCompletedEpisodesFetchMetadataButton()).toBeVisible();
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
    await expect(collectionPage.getCompletedEpisodesProgress()).toContainText('2');
    await expect(collectionPage.getCompletedEpisodesSaveStatus()).toContainText('Saved');
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

  test('updates the item dialog when closed immediately after an episode edit', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
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

  test('offers both bulk actions for partial progress and preserves it when reset is cancelled', async ({
    page,
    api,
  }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`, {
      completedEpisodes: [{ season: 1, episode: 1 }],
    });
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await collectionPage.openCompletedEpisodesActions();
    await expect(collectionPage.getCompletedEpisodesMarkAllCompletedButton()).toBeVisible();
    await expect(collectionPage.getCompletedEpisodesMarkAllUncompletedButton()).toBeVisible();
    await collectionPage.getCompletedEpisodesMarkAllUncompletedButton().click();
    await createMessageDialog(page).cancel();
    await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().first()).toBeChecked();
    const stored = await api.request('GET', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`);
    expect((await stored.json()).data.completedEpisodes).toEqual([{ season: 1, episode: 1 }]);
    await collectionPage.getCompletedEpisodesCloseButton().click();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
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
    await collectionPage.openCompletedEpisodesActions();
    const markCompletedResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesMarkAllCompletedButton().click();
    await createMessageDialog(page).confirm();
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
    await collectionPage.openCompletedEpisodesActions();
    await expect(collectionPage.getCompletedEpisodesMarkAllCompletedButton()).toHaveCount(0);
    const markUncompletedResponsePromise = getCompletedEpisodesResponse(page);
    await collectionPage.getCompletedEpisodesMarkAllUncompletedButton().click();
    await createMessageDialog(page).confirm('Series');
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

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 640, height: 320 },
  ]) {
    test(`keeps episode and metadata controls reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
      api,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
        seasons: [{ season: 1, episodes: 24, titles: ['A long episode title that must wrap within the dialog'] }],
      });
      await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
      await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
      await expect(collectionPage.getCompletedEpisodesCloseButton()).toBeVisible();
      await expect(collectionPage.getCompletedEpisodesDialog()).toBeVisible();
      const episodeBounds = await collectionPage.getCompletedEpisodesDialog().boundingBox();
      expect(episodeBounds).not.toBeNull();
      expect(episodeBounds!.x).toBeGreaterThanOrEqual(0);
      expect(episodeBounds!.x + episodeBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      const rowBounds = await collectionPage.getCompletedEpisodesEpisodeRows().first().boundingBox();
      const labelBounds = await collectionPage.getCompletedEpisodesEpisodeLabels().first().boundingBox();
      expect(rowBounds).not.toBeNull();
      expect(labelBounds).not.toBeNull();
      expect(rowBounds!.height).toBeGreaterThanOrEqual(44);
      expect(Math.round(labelBounds!.height)).toBeGreaterThanOrEqual(48);
      expect(labelBounds!.width).toBeGreaterThan(rowBounds!.width / 2);
      const savedResponse = page.waitForResponse(
        (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/completed-episodes')
      );
      await collectionPage
        .getCompletedEpisodesEpisodeLabels()
        .first()
        .click({
          position: { x: labelBounds!.width - 2, y: labelBounds!.height / 2 },
        });
      expect((await savedResponse).status()).toBe(200);
      await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().first()).toBeChecked();
      await expect(collectionPage.getCompletedEpisodesEpisodeCheckbox().first()).toHaveCSS(
        'accent-color',
        await collectionPage
          .getCompletedEpisodesEpisodeRows()
          .first()
          .evaluate((element) => getComputedStyle(element).color)
      );
      await testInfo.attach('episodes', {
        body: await page.screenshot({ path: testInfo.outputPath('episodes.png') }),
        contentType: 'image/png',
      });
      await collectionPage.openCompletedEpisodesActions();
      await collectionPage.getCompletedEpisodesManageSeasonMetadataButton().click();
      await collectionPage.expandSeriesMetadataSeason(0);
      await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('25');
      await expect(collectionPage.getSeriesMetadataSaveButton()).toBeInViewport();
      await expect(collectionPage.getSeriesMetadataCancelButton()).toBeInViewport();
      const metadataBounds = await collectionPage.getSeriesMetadataDialog().boundingBox();
      expect(metadataBounds).not.toBeNull();
      expect(metadataBounds!.x).toBeGreaterThanOrEqual(0);
      expect(metadataBounds!.x + metadataBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      await testInfo.attach('metadata', {
        body: await page.screenshot({ path: testInfo.outputPath('metadata.png') }),
        contentType: 'image/png',
      });
    });
  }
});
