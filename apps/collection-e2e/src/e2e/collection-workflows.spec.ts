import { buildCollectionItem } from '../fixtures/collection-item';
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

  for (const width of [390, 1280]) {
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
      await message.cancel();
      await expect(collection.getItemDialogDeleteButton()).toBeFocused();
      expect(await parent.boundingBox()).toEqual(before);
    });
  }
});
