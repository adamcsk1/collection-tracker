import { buildCollectionItem, buildCollectionItems } from '../fixtures/collection-item';
import { createCollectionPage } from '../page-objects/collection.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { expect, test } from '../support/test';

test.describe('Collection workflow regressions', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('reaches search before cards and processes input without keyboard events', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Searchable Movie'));
    const collection = createCollectionPage(page);
    await collection.visit();
    await expect(collection.getListItems()).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(collection.getSkipToSearchButton()).toBeFocused();
    await page.keyboard.press('Enter');
    const search = collection.getVisibleStandardSearchInput();
    await expect(search).toBeFocused();
    const response = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/v1/collection-items' &&
        new URL(response.url()).searchParams.get('search') === 'no-such-title'
    );
    await search.fill('no-such-title');
    expect((await response).ok()).toBe(true);
    await expect(collection.getEmptyState()).toBeVisible();
    await expect(search).toHaveValue('no-such-title');
    await collection.getClearFiltersButton().click();
    await expect(collection.getListItems()).toHaveCount(1);
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
  });

  test('matches list clearance to collapsed and expanded toolbar geometry', async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Toolbar Geometry'));
    const collection = createCollectionPage(page);
    await collection.visit();
    const toolbar = page.getByTestId('float-search-bar');
    const list = page.getByTestId('collection-list');
    await expect(page.getByTestId('collection-list-guidance')).toHaveCSS('margin-bottom', '16px');

    const expectMatchingClearance = async (): Promise<void> => {
      const bounds = await toolbar.boundingBox();
      const padding = await list.evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom));
      expect(padding).toBeCloseTo(bounds!.height + (844 - bounds!.y - bounds!.height) + 16, 0);
    };

    await expectMatchingClearance();
    const scrollingToolbar = await list.evaluate(async (element) => {
      element.dispatchEvent(new Event('scroll'));
      await new Promise(requestAnimationFrame);
      const host = document.querySelector('ct-float-actions')!;
      const bar = host.querySelector('[data-test-id="float-search-bar"]')!;
      const toggle = host.querySelector('[data-test-id="show-functions"]')!;
      const bounds = toggle.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const pointerEventsBefore = getComputedStyle(toggle).pointerEvents;
      const intercepted = toggle.contains(hit);
      (document.querySelector('[data-test-id="skip-to-search"]') as HTMLElement).click();
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      return {
        pointerEventsBefore,
        intercepted,
        focused: !!document.activeElement?.closest('[data-test-id="collection-search"]'),
        pointerEventsAfter: getComputedStyle(bar).pointerEvents,
        scrollingDuringFocus: host.classList.contains('float-actions-scrolling'),
      };
    });
    expect(scrollingToolbar).toEqual({
      pointerEventsBefore: 'none',
      intercepted: false,
      focused: true,
      pointerEventsAfter: 'auto',
      scrollingDuringFocus: true,
    });
    await expectMatchingClearance();
    await page.getByTestId('show-functions').click();
    await expect(page.getByTestId('random-pick')).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const expandedAction = await list.evaluate(async (element) => {
      element.dispatchEvent(new Event('scroll'));
      await new Promise(requestAnimationFrame);
      const target = document.querySelector('[data-test-id="random-pick"]')!;
      const bounds = target.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return { pointerEvents: getComputedStyle(target).pointerEvents, intercepted: target.contains(hit) };
    });
    expect(expandedAction).toEqual({ pointerEvents: 'none', intercepted: false });
  });

  test('aligns the scroll-to-top icon with the right edge and returns to the first item', async ({
    page,
    api,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const items = buildCollectionItems(Array.from({ length: 12 }, (_, index) => `Scroll item ${index}`));
    for (const item of items) {
      await api.request('POST', '/api/v1/collection-items', item);
    }
    const collection = createCollectionPage(page);
    await collection.visit();
    await expect(collection.getListItems()).toHaveCount(items.length);
    await collection.getList().evaluate((element) => element.scrollTo(0, 500));
    const scrollButton = collection.getScrollToTopButton();
    await expect(scrollButton).toBeVisible();
    await expect
      .poll(() =>
        page.getByTestId('float-search-bar').evaluate((element) => getComputedStyle(element.parentElement!).opacity)
      )
      .toBe('1');
    await expect(scrollButton.locator('..')).not.toHaveClass(/animation-fade-in/);
    const bounds = await scrollButton.boundingBox();
    const toolbar = await page.getByTestId('float-search-bar').boundingBox();
    expect(bounds!.width).toBe(45);
    expect(bounds!.height).toBe(45);
    expect(bounds!.x).toBeGreaterThan(300);
    expect(bounds!.y + bounds!.height).toBeLessThan(toolbar!.y);
    await page.screenshot({ path: testInfo.outputPath('scroll-to-top.png') });
    await scrollButton.click();
    await expect.poll(() => collection.getList().evaluate((element) => element.scrollTop)).toBe(0);
  });

  test('protects an unsaved addition and restores focus after cancelling discard', async ({ page }) => {
    const collection = createCollectionPage(page);
    const message = createMessageDialog(page);
    await collection.openNewItemDialog();
    await collection.getNewItemManualModeButton().click();
    await collection.getNewItemManualTitleInput().fill('Keep this draft');
    await page.keyboard.press('Escape');
    await message.cancel();
    await expect(collection.getNewItemManualTitleInput()).toHaveValue('Keep this draft');
    await expect(collection.getNewItemManualTitleInput()).toBeFocused();
    await page.keyboard.press('Escape');
    await message.confirm();
    await expect(collection.getNewItemManualTitleInput()).toHaveCount(0);
    await expect(collection.getAddNewButton()).toBeFocused();
  });

  test('keeps completion control focused and Escape usable after updating status', async ({ page, api }) => {
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Keyboard Completion'));
    const collection = createCollectionPage(page);
    await collection.visit();
    await collection.getListItemTitleButtons().first().click();
    const finish = collection.getItemDialogMarkFinishedButton();
    for (
      let index = 0;
      index < 20 && !(await finish.evaluate((element) => element === document.activeElement));
      index++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(finish).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(collection.getItemDialogMarkUnfinishedButton()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(collection.getItemDialogHost()).toHaveCount(0);
    await expect(collection.getListItemTitleButtons().first()).toBeFocused();
  });

  for (const width of [320, 390, 1280]) {
    test(`fits Add content and keeps toolbar actions aligned at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const collection = createCollectionPage(page);
      await collection.visit();
      const toolbar = page.getByTestId('float-search-bar');
      const add = collection.getAddNewButton();
      const toggle = page.getByTestId('show-functions');
      await expect(add).toBeVisible();
      await expect(toggle).toBeVisible();
      const addBounds = await add.boundingBox();
      const toggleBounds = await toggle.boundingBox();
      expect(addBounds!.y).toBeCloseTo(toggleBounds!.y, 0);
      expect(toggleBounds!.x + toggleBounds!.width).toBeLessThanOrEqual(width);
      await (await collection.getSearchInput()).focus();
      await expect(toolbar).toHaveCSS('flex-wrap', width > 650 ? 'nowrap' : 'wrap');
      await page.screenshot({ path: testInfo.outputPath('toolbar-expanded.png') });
      await toggle.click();
      await expect(collection.getOrderByAlphabetButton()).toBeVisible();
      const popup = page.getByTestId('collection-actions-popup');
      await expect.poll(async () => (await popup.boundingBox())?.width ?? 0).toBeCloseTo(Math.min(384, width - 32), 1);
      const popupBounds = await popup.boundingBox();
      expect(popupBounds!.width).toBeGreaterThanOrEqual(250);
      expect(popupBounds!.x).toBeGreaterThanOrEqual(0);
      expect(popupBounds!.x + popupBounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath('toolbar-actions.png') });
      await page.getByTestId('hide-functions').click();
      await collection.openNewItemDialog();
      const frame = page.getByTestId('dialog-frame').last();
      await expect(frame).toHaveClass(/content-sized/);
      await expect(frame).toHaveCSS('transform', 'none');
      await expect(frame).toHaveCSS('outline-style', 'none');
      await expect(frame).toHaveCSS('border-top-width', '0px');
      const searchBounds = await frame.boundingBox();
      expect(searchBounds!.height).toBeLessThan(700);
      expect(searchBounds!.y + searchBounds!.height).toBeCloseTo(900, 0);
      await page.screenshot({ path: testInfo.outputPath('add-search.png') });
      await collection.getNewItemManualModeButton().click();
      await expect(collection.getNewItemManualHint()).toBeVisible();
      await expect(collection.getNewItemManualTitleInput()).toBeVisible();
      const hint = await collection.getNewItemManualHint().boundingBox();
      const title = await collection.getNewItemManualTitleInput().boundingBox();
      expect(title!.y).toBeGreaterThanOrEqual(hint!.y + hint!.height + 12);
      const save = await collection.getNewItemSaveButton().boundingBox();
      const saveAndClose = await collection.getNewItemSaveAndCloseButton().boundingBox();
      expect(save!.y + save!.height / 2).toBeCloseTo(saveAndClose!.y + saveAndClose!.height / 2, 0);
      expect(await frame.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('add-manual.png') });
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('add-manual-dark.png') });
    });

    test(`keeps parent geometry and separates compact confirmation at ${width}px`, async ({ page, api }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Stack Geometry'));
      const collection = createCollectionPage(page);
      const message = createMessageDialog(page);
      await collection.visit();
      await collection.getListItemTitleButtons().first().click();
      const parent = collection.getItemDialogHost();
      await expect(parent).toHaveCSS('transform', 'none');
      const before = await parent.boundingBox();
      await collection.getItemDialogDeleteButton().click();
      await expect(message.getDialog()).toBeVisible();
      await expect(message.getDialog()).toHaveCSS('transform', 'none');
      await expect(message.getDialog()).toHaveCSS('border-top-style', 'solid');
      await expect(message.getDialogHost().getByTestId('message-dialog-input')).toHaveCSS('margin-top', '16px');
      await expect(message.getDragHandle()).toHaveCount(0);
      const after = await parent.boundingBox();
      expect(after).toEqual(before);
      const panel = await message.getDialog().boundingBox();
      expect(panel!.x).toBeGreaterThan(0);
      expect(panel!.y).toBeGreaterThan(0);
      expect(panel!.y + panel!.height).toBeLessThan(900);
      await page.screenshot({ path: testInfo.outputPath('compact-confirmation.png') });
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('compact-confirmation-dark.png') });
      await page.setViewportSize({ width, height: 500 });
      const resizedPanel = await message.getDialog().boundingBox();
      expect(resizedPanel!.y).toBeGreaterThanOrEqual(0);
      expect(resizedPanel!.y + resizedPanel!.height).toBeLessThanOrEqual(500);
      expect(Math.abs(resizedPanel!.y - (500 - resizedPanel!.height) / 2)).toBeLessThan(2);
      const resizedParent = await parent.boundingBox();
      await message.getCancelButton().click();
      await expect(message.getDialog()).toHaveClass(/compact-leave/);
      await expect(message.getDialogHost()).toHaveCount(0);
      await expect(collection.getItemDialogDeleteButton()).toBeFocused();
      expect(await parent.boundingBox()).toEqual(resizedParent);
    });
  }
});
