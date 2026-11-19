import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { createCollectionPage } from '../page-objects/collection.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { expect, test } from '../support/test';
import { fillAutocomplete } from '../support/input-util';

let collectionPage: ReturnType<typeof createCollectionPage>;
test.beforeEach(({ page }) => {
  collectionPage = createCollectionPage(page);
});

test.describe('Item dialog — edit flow', () => {
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Edit Test Movie', 'movie', 'tt7000001'));
    await collectionPage.visit();
  });

  test('dismisses More with Escape and close without closing its parent or losing focus', async ({ page }) => {
    await collectionPage.getListItemTitleButtons().first().click();
    await expect(collectionPage.getItemDialogEditButton()).toBeHidden();
    await expect(collectionPage.getItemDialogMarkFinishedButton()).toBeVisible();
    await expect(collectionPage.getItemDialogMarkFavoriteButton()).toBeVisible();

    await collectionPage.getItemDialogMoreButton().focus();
    await collectionPage.getItemDialogMoreButton().press('Enter');
    await expect(collectionPage.getItemDialogMoreCloseButton()).toBeFocused();
    await expect(collectionPage.getItemDialogEditButton()).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(collectionPage.getItemDialogMoreDialog()).toBeHidden();
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogMoreButton()).toHaveAttribute('aria-expanded', 'false');
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(page).toHaveURL(/item=/);

    await collectionPage.openItemActions();
    await collectionPage.getItemDialogMoreCloseButton().click();
    await expect(collectionPage.getItemDialogMoreDialog()).toBeHidden();
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
  });

  test('wraps parent keyboard focus without entering closed More actions', async ({ page }) => {
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.getItemDialogDragHandle().focus();
    await page.keyboard.press('Shift+Tab');
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(collectionPage.getItemDialogDragHandle()).toBeFocused();

    await collectionPage.openItemActions();
    await page.keyboard.press('Escape');
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(collectionPage.getItemDialogDragHandle()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
  });

  test('closes More before entering edit mode', async () => {
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().click();

    await expect(collectionPage.getItemDialogMoreDialog()).toBeHidden();
    await expect(collectionPage.getItemDialogTitleInput()).toBeVisible();
    await expect(collectionPage.getItemDialogSaveButton()).toBeVisible();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
  });

  for (const viewport of [
    { width: 390, height: 844, duration: '0.2s' },
    { width: 1280, height: 900, duration: '0.16s' },
  ]) {
    test(`animates More before closing at ${viewport.width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await collectionPage.getListItemTitleButtons().first().click();
      await collectionPage.openItemActions();
      const dialog = collectionPage.getItemDialogMoreDialog();
      await expect(dialog).toHaveCSS('animation-duration', viewport.duration);
      await expect(dialog).toHaveCSS('opacity', '1');

      const openDuringExit = await collectionPage.getItemDialogMoreCloseButton().evaluate((button) => {
        (button as HTMLButtonElement).click();
        return button.closest('dialog')?.open;
      });

      expect(openDuringExit).toBe(true);
      await expect(dialog).toBeHidden();
      await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
      await expect(collectionPage.getItemDialogHost()).toBeVisible();
    });
  }

  test('skips More animations and closes immediately with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.openItemActions();
    const dialog = collectionPage.getItemDialogMoreDialog();
    expect(await dialog.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);

    const openAfterClose = await collectionPage.getItemDialogMoreCloseButton().evaluate((button) => {
      (button as HTMLButtonElement).click();
      return button.closest('dialog')?.open;
    });

    expect(openAfterClose).toBe(false);
    await expect(dialog).toBeHidden();
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
  });

  test('returns focus to More after cancelling delete confirmation', async ({ page }) => {
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogDeleteButton().click();
    await expect(collectionPage.getItemDialogMoreDialog()).toBeHidden();
    const messageDialog = createMessageDialog(page);
    await expect(messageDialog.getDialog()).toBeVisible();
    await messageDialog.cancel();

    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogMoreDialog()).toBeHidden();
    await expect(collectionPage.getItemDialogHost()).toContainText('Edit Test Movie');
    await expect(page).toHaveURL(/item=/);
  });

  for (const viewport of [
    { width: 320, height: 600 },
    { width: 390, height: 844 },
    { width: 650, height: 844 },
    { width: 651, height: 844 },
    { width: 740, height: 360 },
    { width: 1280, height: 900 },
  ]) {
    test(`keeps labelled actions usable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await collectionPage.getListItemTitleButtons().first().click();
      await collectionPage.expectItemDialogActionsVisible();
      const frame = collectionPage.getItemDialogHost();
      await expect(frame).toHaveCSS('transform', 'none');
      const menu = collectionPage.getItemDialogActionsMenu();
      expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(collectionPage.getItemDialogActionButtons()).toHaveCount(3);
      for (const button of await collectionPage.getItemDialogActionButtons().all()) {
        await button.scrollIntoViewIfNeeded();
        await expect(button.locator('span')).toBeVisible();
        const bounds = (await button.boundingBox())!;
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      }
      await page.screenshot({ path: testInfo.outputPath('item-actions.png') });
      await collectionPage.openItemActions();
      await expect(collectionPage.getItemDialogMoreDialog()).toHaveAttribute('open', '');
      await collectionPage.waitForItemActionsAnimation();
      const moreBounds = (await collectionPage.getItemDialogMoreDialog().boundingBox())!;
      expect(moreBounds.x).toBeGreaterThanOrEqual(0);
      expect(moreBounds.y).toBeGreaterThanOrEqual(0);
      expect(moreBounds.x + moreBounds.width).toBeLessThanOrEqual(viewport.width);
      expect(moreBounds.y + moreBounds.height).toBeLessThanOrEqual(viewport.height);
      if (viewport.width <= 650) {
        expect(moreBounds.x).toBe(0);
        expect(moreBounds.width).toBe(viewport.width);
        expect(moreBounds.y + moreBounds.height).toBeCloseTo(viewport.height, 0);
      }
      await page.screenshot({ path: testInfo.outputPath('item-more-actions.png') });
      await collectionPage.getItemDialogEditButton().click();
      await expect(collectionPage.getItemDialogSaveLabel()).toBeVisible();
      await expect(collectionPage.getItemDialogSaveButton()).toHaveClass(/dialog-action-primary/);
      await expect(collectionPage.getItemDialogReadOnlyButton().locator('span')).toBeVisible();
      const save = (await collectionPage.getItemDialogSaveButton().boundingBox())!;
      expect(save.y + save.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: testInfo.outputPath('edit-actions.png') });
    });
  }

  test('resizes open More between mobile sheet and desktop popup', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.openItemActions();
    const dialog = collectionPage.getItemDialogMoreDialog();

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await collectionPage.waitForItemActionsAnimation();
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      if (viewport.width <= 650) {
        expect(bounds.x).toBe(0);
        expect(bounds.width).toBe(viewport.width);
        expect(bounds.y + bounds.height).toBeCloseTo(viewport.height, 0);
      }
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
  });

  test('keeps More surfaces and Delete corners consistent in both themes', async ({ page }, testInfo) => {
    await collectionPage.getListItemTitleButtons().first().click();
    await collectionPage.openItemActions();
    const dialog = collectionPage.getItemDialogMoreDialog();
    const deleteButton = collectionPage.getItemDialogDeleteButton();

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark')))
        .toBe(colorScheme === 'dark');
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await collectionPage.waitForItemActionsAnimation();
        await expect(dialog).toHaveCSS('padding-top', '16px');
        await expect(dialog).toHaveCSS('border-top-width', width <= 650 ? '0px' : '1px');
        await expect(dialog).toHaveCSS('border-bottom-left-radius', width <= 650 ? '0px' : '5px');
        expect(await dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter)).toBe(
          width <= 650 ? 'blur(16px)' : 'none'
        );
        const editRadius = await collectionPage
          .getItemDialogEditButton()
          .evaluate((element) => getComputedStyle(element).borderRadius);
        expect(editRadius).not.toBe('0px');
        await expect(deleteButton).toHaveCSS('border-radius', editRadius);
        await expect(dialog.getByTestId('item-dialog-destructive-divider')).toBeVisible();
        await deleteButton.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(deleteButton).toBeFocused();
        await expect(deleteButton).toHaveCSS('outline-style', 'solid');
        await expect(deleteButton).toHaveCSS('outline-width', '2px');
        await page.mouse.move(0, 0);
        await page.screenshot({ path: testInfo.outputPath(`more-delete-focus-${colorScheme}-${width}.png`) });
      }
    }
  });

  test('keeps footer labels visible during keyboard navigation', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogReadOnlyButton().focus();
    await page.keyboard.press('Tab');
    await expect(collectionPage.getItemDialogSaveButton()).toBeFocused();
    await expect(collectionPage.getItemDialogSaveLabel()).toBeVisible();
  });

  test('edits the title of an existing item and persists the change', async ({ page }) => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('9.4');
    const firstResponsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().click();
    await firstResponsePromise;
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogUserRateInput().fill('8.75');
    await expect(collectionPage.getItemDialogSaveButton()).toBeDisabled();
  });

  test('keeps save disabled for invalid edited external rating formats', async () => {
    await collectionPage.getListItemImages().first().click();
    await collectionPage.expectItemDialogActionsVisible();
    await collectionPage.openItemActions();
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
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().click();
    await collectionPage.getItemDialogTitleInput().fill('Discarded Title');
    await page.getByTestId('item-dialog-read-only').click();
    await createMessageDialog(page).confirm();
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
    await collectionPage.openItemActions();
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
  test.beforeEach(async ({ autoLogin, api }) => {
    await autoLogin();
    await api.request(
      'POST',
      '/api/v1/collection-items',
      buildCollectionItem('Watch Test Movie', 'movie', 'tt7000002')
    );
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
