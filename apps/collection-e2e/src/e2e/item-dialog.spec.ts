import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { createCollectionPage } from '../page-objects/collection.po';
import { expect, test } from '../support/test';
import { fillAutocomplete } from '../support/input-util';

let collectionPage: ReturnType<typeof createCollectionPage>;
test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
});

test.describe('Item dialog — edit flow', () => {
  test.beforeEach(async ({ autoLogin, api, page }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Edit Test Movie', 'movie', 'tt7000001'));
    page.on('dialog', (dialog) => dialog.accept());
    await collectionPage.visit();
  });

  test('shows an action label on touch hold without executing the action', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogEditButton().locator('.button-reveal-label-text')).toBeHidden();
    await expect
      .poll(async () => {
        const iconCenters = await collectionPage.getItemDialogActionButtons().evaluateAll((buttons) =>
          buttons.map((button) => {
            const icon = button.querySelector('.material-icons');
            if (!icon) throw new Error('Dialog action icon is unavailable');
            const bounds = icon.getBoundingClientRect();
            return bounds.top + bounds.height / 2;
          })
        );
        return iconCenters.slice(1).every((center) => Math.abs(center - iconCenters[0]!) <= 1);
      })
      .toBe(true);
    const editLabel = await collectionPage.getItemDialogEditButton().getAttribute('aria-label');
    await collectionPage.holdItemDialogAction('item-dialog-edit');
    await expect(collectionPage.getDialogActionTooltip()).toHaveText(editLabel!);
    await expect
      .poll(async () => {
        const button = await collectionPage.getItemDialogEditButton().boundingBox();
        const dialog = await collectionPage.getItemDialogHost().boundingBox();
        const tooltipLeft = await collectionPage
          .getDialogActionTooltip()
          .evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
        return Math.abs(tooltipLeft - (button!.x + button!.width / 2 - dialog!.x));
      })
      .toBeLessThanOrEqual(1);
    await collectionPage.releaseHeldItemDialogAction('item-dialog-edit');
    await expect(collectionPage.getDialogActionTooltip()).toHaveCount(0);
    await expect(collectionPage.getItemDialogSaveButton()).toHaveCount(0);

    await collectionPage.getItemDialogEditButton().click();
    await expect(collectionPage.getItemDialogSaveButton()).toBeVisible();
    await expect(collectionPage.getItemDialogSaveButton().locator('.button-reveal-label-text')).toBeHidden();
    const saveLabel = await collectionPage.getItemDialogSaveButton().getAttribute('aria-label');
    await collectionPage.holdItemDialogAction('item-dialog-save');
    await expect(collectionPage.getDialogActionTooltip()).toHaveText(saveLabel!);
    await collectionPage.releaseHeldItemDialogAction('item-dialog-save');
    await expect(collectionPage.getItemDialogSaveButton()).toBeVisible();
  });

  test('reveals a footer action label on keyboard focus', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogReadOnlyButton().focus();
    await page.keyboard.press('Tab');
    await expect(collectionPage.getItemDialogSaveButton()).toBeFocused();
    await expect(collectionPage.getItemDialogSaveLabel()).toBeVisible();
  });

  test('edits the title of an existing item and persists the change', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Updated Title');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(page.getByTestId('item-dialog-title')).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toContainText('Updated Title');
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItems()).toContainText('Updated Title');
  });

  test('edits multiple fields and persists the changes', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogYearInput().fill('2025');
    await fillAutocomplete(collectionPage.getItemDialogGenreInput(), 'Drama, Comedy');
    await fillAutocomplete(collectionPage.getItemDialogTagsInput(), '#updated');
    await collectionPage.getItemDialogActorsInput().fill('New Actor One, New Actor Two');
    await collectionPage.getItemDialogPlotInput().fill('An updated plot for testing.');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    expect((await responsePromise).status()).toBe(200);
    for (const text of [
      '2025',
      'Drama',
      'Comedy',
      '#updated',
      'New Actor One, New Actor Two',
      'An updated plot for testing.',
    ]) {
      await expect(collectionPage.getItemDialogHost().getByText(text).first()).toBeVisible();
    }
    await collectionPage
      .getItemDialogHost()
      .getByText('An updated plot for testing.', { exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      collectionPage.getItemDialogHost().getByText('An updated plot for testing.', { exact: true })
    ).toBeVisible();
  });

  test('edits the user rate and persists the change', async ({ page, api }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('9.4');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getItemDialogUserRateChip()).toContainText('9.4');
    await collectionPage.closeActiveDialogByOverlay();
    await collectionPage.setListPreferredRatingToUser(api);
    await collectionPage.visit();
    await expect(collectionPage.getListItemUserRates()).toContainText('9.4');
  });

  test('clears an existing user rate', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('9.4');
    const firstResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    await firstResponsePromise;
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getItemDialogUserRateChip()).toHaveCount(0);
    await collectionPage.closeActiveDialogByOverlay();
    await expect(collectionPage.getListItemUserRates()).toHaveCount(0);
  });

  test('keeps save disabled for an invalid edited user rate', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('8.75');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
  });

  test('keeps save disabled for invalid edited external rating formats', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogIMDbRateInput().fill('10.1');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
    await collectionPage.getItemDialogIMDbRateInput().fill('10');
    await collectionPage.getItemDialogRottenTomatoesRateInput().fill('101%');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
    await collectionPage.getItemDialogRottenTomatoesRateInput().fill('100%');
    await collectionPage.getItemDialogMetacriticRateInput().fill('59%');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
  });

  test('discards draft changes when read-only is clicked', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Discarded Title');
    await page.getByTestId('item-dialog-read-only').click();
    await expect(collectionPage.getItemDialogHost()).toContainText('Edit Test Movie');
    await expect(page.getByText('Discarded Title', { exact: true })).toHaveCount(0);
  });
});

test.describe('Item dialog — tag autocomplete', () => {
  const tags = ['#bluary', '#english-cover', '#season01', '#season02', '#season03', '#season04', '#season05'];
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Tag Suggestion Movie', 'movie', 'tt7000002'),
      tags,
    });
    await collectionPage.visit();
  });
  test('shows three later suggestions when earlier matches are already selected', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.getItemDialogEditButton().click();
    await fillAutocomplete(collectionPage.getItemDialogTagsInput(), '#bluary #english-cover #season01 #season02 #');
    await expect(collectionPage.getItemDialogTagSuggestions()).toHaveCount(3);
    await expect(collectionPage.getItemDialogTagSuggestions().filter({ hasText: '#season03' })).toBeVisible();
  });
});

test.describe('Item dialog — external links', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Link Test Movie', 'movie', 'tt7000003'));
    await collectionPage.visit();
  });
  test('shows the YouTube trailer link with the correct href', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(page.getByTestId('video')).toHaveAttribute('href', /youtube\.com/);
    await expect(page.getByTestId('video')).toHaveAttribute('href', /Link%20Test%20Movie/);
  });
  test('shows the web search link with the correct href', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(page.getByTestId('about-web-search-link')).toHaveAttribute('href', /duckduckgo\.com/);
    await expect(page.getByTestId('about-web-search-link')).toHaveAttribute('href', /Link%20Test%20Movie/);
  });
});

test.describe('Item dialog — mark watched / unwatched', () => {
  test.beforeEach(async ({ autoLogin, api, page }) => {
    await autoLogin();
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Watch Test Movie', 'movie', 'tt7000002')
    );
    page.on('dialog', (dialog) => dialog.accept());
    await collectionPage.visit();
  });
  test('marks an unwatched item as watched', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    await collectionPage.getItemDialogMarkFinishedButton().click();
    expect((await responsePromise).status()).toBe(200);
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogMarkUnfinishedButton()).toBeVisible();
  });
  test('marks a watched item as unwatched', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    const watchedResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracking')
    );
    await collectionPage.getItemDialogMarkFinishedButton().click();
    await watchedResponsePromise;
    await collectionPage.expectItemDialogActionsVisible();
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().includes('/tracking/completed')
    );
    await collectionPage.getItemDialogMarkUnfinishedButton().click();
    expect((await responsePromise).status()).toBe(204);
    await collectionPage.expectItemDialogActionsVisible();
    await expect(collectionPage.getItemDialogMarkFinishedButton()).toBeVisible();
  });
});

test.describe('Item dialog — url', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Url Test Movie', 'movie', 'tt7000091'));
    await collectionPage.visit();
  });
  test('writes the opened item to the query string and clears it on close', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/item=omdb:tt7000091/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
  });
  test('opens an item from the query string', async ({ page }) => {
    await collectionPage.visitLibraryWithQuery('item=omdb:tt7000091');
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/item=omdb:tt7000091/);
    await expect(collectionPage.getItemDialogHost()).toContainText('Url Test Movie');
  });
  test('strips a missing item from the query string', async ({ page }) => {
    await collectionPage.visitLibraryWithQuery('item=omdb:tt7000099');
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
  });
  test('closes the item dialog on browser back', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/item=omdb:tt7000091/);
    await page.goBack();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).toHaveURL(/#\/collection\/library/);
    await expect(page).not.toHaveURL(/item=/);
  });
  test('keeps filters when an item is opened and closed', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/v1/collection-items' &&
        new URL(response.url()).searchParams.get('type') === 'movie'
    );
    await collectionPage.visitLibraryWithQuery('type=movie');
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getListItemByTitle('Url Test Movie')).toBeVisible();
    await collectionPage.getListItemImageByTitle('Url Test Movie').click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/type=movie/);
    await expect(page).toHaveURL(/item=omdb:tt7000091/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).toHaveURL(/type=movie/);
    await expect(page).not.toHaveURL(/item=/);
  });
  test('does not reopen the item after overlay close then back', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/item=omdb:tt7000091/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
    await page.goBack();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).toHaveURL(/#\/collection\/library/);
    await expect(page).not.toHaveURL(/item=/);
  });
});

test.describe('Item dialog — tracking url', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Url Tracking Series', 'series', 'tt7000092'),
      listType: 'tracking',
    });
    await collectionPage.visitTracking();
  });
  test('writes and restores a tracking item from the query string', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/#\/collection\/tracking/);
    await expect(page).toHaveURL(/item=omdb:tt7000092/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
    await collectionPage.visitTrackingWithQuery('item=omdb:tt7000092');
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogHost()).toContainText('Url Tracking Series');
  });
});

test.describe('Item dialog — books url', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildBooksItem('Url Test Book', '9780306406195'));
    await collectionPage.visitBooks();
  });
  test('writes and restores a book item from the query string', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/#\/collection\/books/);
    await expect(page).toHaveURL(/item=openlibrary:9780306406195/);
    await collectionPage.closeDialogByOverlay();
    await expect(collectionPage.getItemDialogShellHost()).toHaveCount(0);
    await expect(page).not.toHaveURL(/item=/);
    await collectionPage.visitBooksWithQuery('item=openlibrary:9780306406195');
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogHost()).toContainText('Url Test Book');
  });
});
