import type { Page } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { expect, test, type ApiClient } from '../support/test';

let collectionPage: ReturnType<typeof createCollectionPage>;

test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
});

const openMovieItemDialog = async (
  title: string,
  imdbId: string,
  autoLogin: () => Promise<void>,
  api: ApiClient
): Promise<void> => {
  await autoLogin();
  await api.request('POST', '/api/v1/collection-items', buildCollectionItem(title, 'movie', imdbId));
  await collectionPage.visit();
  await expect(collectionPage.getListItems().filter({ hasText: title })).toBeVisible();
  await collectionPage.getListItemImages().first().click();
  await expect(collectionPage.getItemDialogHost()).toBeVisible();
};

const setMobileViewport = async (page: Page) => {
  await page.setViewportSize({ width: 375, height: 812 });
};

test.describe('Dialog gesture close', () => {
  test('returns focus to the floating actions opener after closing new item', async ({ page, autoLogin, api }) => {
    await autoLogin();
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Focus Return Movie', 'movie', 'tt7100015')
    );
    await collectionPage.visit();
    await expect(collectionPage.getListItems().filter({ hasText: 'Focus Return Movie' })).toBeVisible();
    await collectionPage.getShowFunctionsButton().click();
    await collectionPage.getAddNewButton().focus();
    await page.keyboard.press('Enter');
    await expect(collectionPage.getNewItemSearch()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(collectionPage.getShowFunctionsButton()).toBeFocused();
  });

  test('closes the active dialog from the mobile left screen edge', async ({ page, autoLogin, api }) => {
    await setMobileViewport(page);
    await openMovieItemDialog('Left Edge Gesture Movie', 'tt7100011', autoLogin, api);

    await collectionPage.swipeActiveDialogFromLeftEdge();

    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
  });

  test('closes the active dialog from the mobile right screen edge', async ({ page, autoLogin, api }) => {
    await setMobileViewport(page);
    await openMovieItemDialog('Right Edge Gesture Movie', 'tt7100012', autoLogin, api);

    await collectionPage.swipeActiveDialogFromRightEdge();

    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
  });

  test('does not close from an edge swipe on desktop', async ({ page, autoLogin, api }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await openMovieItemDialog('Desktop Edge Gesture Movie', 'tt7100013', autoLogin, api);

    await collectionPage.swipeActiveDialogFromLeftEdge();

    await expect(collectionPage.getItemDialogHost()).toBeVisible();
  });

  test('closes only the top stacked dialog from a mobile screen edge', async ({ page, autoLogin, api }) => {
    const title = 'Stacked Gesture Test Show';
    const imdbId = 'tt7100014';

    await setMobileViewport(page);
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem(title, 'series', imdbId),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
    await collectionPage.getListItems().filter({ hasText: title }).click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogManageSeriesMetadataButton().click();
    await expect(collectionPage.getSeriesMetadataDialog()).toBeVisible();

    await collectionPage.swipeActiveDialogFromRightEdge();

    await expect(collectionPage.getSeriesMetadataDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogComponentHost()).not.toHaveClass(/dialog-stacked/);
    await expect(collectionPage.getItemDialogComponentHost()).not.toHaveAttribute('inert', /[\s\S]*/);
    await expect(collectionPage.getItemDialogComponentHost()).not.toHaveAttribute('aria-hidden', /[\s\S]*/);
  });
});
