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
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.openSeriesMetadataActions();
    await expect(collectionPage.getSeriesMetadataRefreshButton()).toBeVisible();
    await collectionPage.closeSeriesMetadataActions();

    await expect(collectionPage.getSeriesMetadataMessage()).toContainText(
      'Expand a season to edit optional episode titles.'
    );
    await collectionPage.getSeriesMetadataAddButton().click();
    await collectionPage.getSeriesMetadataAddButton().click();
    await expect(collectionPage.getSeriesMetadataSeasonToggles().nth(1)).toHaveAttribute('aria-expanded', 'true');

    await collectionPage.expandSeriesMetadataSeason(0);
    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('0');
    await expect(collectionPage.getSeriesMetadataValidation()).toBeVisible();
    await expect(collectionPage.getSeriesMetadataSaveButton()).toBeDisabled();

    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('3');
    await expect(collectionPage.getSeriesMetadataSeasonToggles().nth(0)).toContainText('3 episodes');
    await collectionPage.expandSeriesMetadataSeason(1);
    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('2');
    await expect(collectionPage.getSeriesMetadataValidation()).toHaveCount(0);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataSaveButton().click();

    expect((await responsePromise).status()).toBe(200);
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
    await expect(collectionPage.getItemDialogManageSeriesMetadataButton()).toBeVisible();
  });

  test('removes stored season metadata', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [
        { season: 1, episodes: 3 },
        { season: 2, episodes: 2 },
      ],
    });

    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();

    await expect(collectionPage.getCompletedEpisodesDialog()).toBeVisible();
    await expect(collectionPage.getCompletedEpisodesNoMetadataMessage()).toHaveCount(0);
    await collectionPage.closeActiveDialogByOverlay();

    await expect(page.getByTestId('completed-episodes-dialog')).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.openSeriesMetadataActions();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataRemoveAllButton().click();
    await createMessageDialog(page).confirm('Series metadata');

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
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();

    await collectionPage.expandSeriesMetadataSeason(0);
    await collectionPage.getSeriesMetadataEpisodeTitleToggles().first().click();
    await expect(collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(0)).toHaveValue('Alpha');
    await expect(collectionPage.getSeriesMetadataEpisodeTitleInputs().nth(1)).toHaveValue('Beta');
  });

  test('shows no-metadata message when no metadata is set', async () => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();

    await expect(collectionPage.getSeriesMetadataNoMetadataMessage()).toBeVisible();
  });

  test('preserves a dirty draft on cancelled close and discards only after confirmation', async ({ page }) => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.getSeriesMetadataAddButton().click();
    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('4');
    await collectionPage.getSeriesMetadataCloseButton().click();
    await createMessageDialog(page).cancel();
    await expect(collectionPage.getSeriesMetadataEpisodeInputs().first()).toHaveValue('4');
    await expect(collectionPage.getSeriesMetadataCloseButton()).toBeFocused();
    await collectionPage.getSeriesMetadataCancelButton().click();
    await createMessageDialog(page).confirm();
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await expect(collectionPage.getSeriesMetadataNoMetadataMessage()).toBeVisible();
  });

  test('confirms a metadata reduction before pruning saved progress', async ({ page, api }) => {
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/seasons`, {
      seasons: [{ season: 1, episodes: 3 }],
    });
    await api.request('PUT', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`, {
      completedEpisodes: [{ season: 1, episode: 3 }],
    });
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await collectionPage.expandSeriesMetadataSeason(0);
    await collectionPage.getSeriesMetadataEpisodeInputs().first().fill('1');
    await expect(collectionPage.getSeriesMetadataProgressWarning()).toBeVisible();
    await collectionPage.getSeriesMetadataSaveButton().click();
    await createMessageDialog(page).cancel();
    await expect(collectionPage.getSeriesMetadataEpisodeInputs().first()).toHaveValue('1');
    const unchanged = await api.request('GET', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`);
    expect((await unchanged.json()).data.completedEpisodes).toEqual([{ season: 1, episode: 3 }]);
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/tracking/seasons')
    );
    await collectionPage.getSeriesMetadataSaveButton().click();
    await createMessageDialog(page).confirm('Series metadata');
    expect((await saved).status()).toBe(200);
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    const reduced = await api.request('GET', `/api/v1/collection-items/omdb/${imdbId}/tracking/completed-episodes`);
    expect((await reduced.json()).data.completedEpisodes).toEqual([]);
  });
});
