import type { Locator, Page, Response } from '@playwright/test';
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

const expectDialogHostActive = async (host: Locator) => {
  await expect(host).not.toHaveClass(/dialog-stacked/);
  await expect(host).not.toHaveAttribute('inert', /[\s\S]*/);
  await expect(host).not.toHaveAttribute('aria-hidden', /[\s\S]*/);
};

const expectDialogHostStacked = async (host: Locator) => {
  await expect(host).toHaveClass(/dialog-stacked/);
  await expect(host).toHaveAttribute('inert', /[\s\S]*/);
  await expect(host).toHaveAttribute('aria-hidden', 'true');
};

const expectDialogHostStackTop = async (host: Locator) => {
  await expect(host).toHaveClass(/dialog-stack-top/);
  await expect(host).not.toHaveClass(/dialog-stacked/);
  await expect(host).not.toHaveAttribute('inert', /[\s\S]*/);
  await expect(host).not.toHaveAttribute('aria-hidden', /[\s\S]*/);
};

const expectActiveDialogFocused = async () => {
  await expect
    .poll(() =>
      collectionPage
        .getActiveDialogFrame()
        .evaluate(
          (dialogFrame) =>
            dialogFrame === dialogFrame.ownerDocument.activeElement ||
            dialogFrame.contains(dialogFrame.ownerDocument.activeElement)
        )
    )
    .toBe(true);
};

test.describe('Stacked dialogs', () => {
  const imdbId = 'tt8300010';
  const seriesTitle = 'Stacked Dialog Test Show';

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

  test('keeps only the top dialog interactive across every app-supported stack depth', async () => {
    await collectionPage.getListItems().filter({ hasText: seriesTitle }).click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expectDialogHostActive(collectionPage.getItemDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await expect(collectionPage.getSeriesMetadataDialog()).toBeVisible();
    await expectDialogHostStacked(collectionPage.getItemDialogComponentHost());
    await expectDialogHostStackTop(collectionPage.getSeriesMetadataDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    await expectDialogHostActive(collectionPage.getItemDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogManageCompletedEpisodesButton().click();
    await expect(collectionPage.getCompletedEpisodesDialog()).toBeVisible();
    await expectDialogHostStacked(collectionPage.getItemDialogComponentHost());
    await expectDialogHostStackTop(collectionPage.getCompletedEpisodesDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.getCompletedEpisodesManageSeasonMetadataButton().click();
    await expect(collectionPage.getSeriesMetadataDialog()).toBeVisible();
    await expectDialogHostStacked(collectionPage.getItemDialogComponentHost());
    await expectDialogHostStacked(collectionPage.getCompletedEpisodesDialogComponentHost());
    await expectDialogHostStackTop(collectionPage.getSeriesMetadataDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    await expectDialogHostStacked(collectionPage.getItemDialogComponentHost());
    await expectDialogHostStackTop(collectionPage.getCompletedEpisodesDialogComponentHost());
    await expectActiveDialogFocused();

    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getCompletedEpisodesDialogHost()).toHaveCount(0);
    await expectDialogHostActive(collectionPage.getItemDialogComponentHost());
    await expectActiveDialogFocused();
  });
});
