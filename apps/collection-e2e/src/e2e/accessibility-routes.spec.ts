import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createAboutPage } from '../page-objects/about.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { createHealthPage } from '../page-objects/health.po';
import { createMessageDialog } from '../page-objects/message-dialog.po';
import { createSettingsPage } from '../page-objects/settings.po';
import { createSignInPage } from '../page-objects/sign-in.po';
import { createStatisticsPage } from '../page-objects/statistics.po';
import { expect, test } from '../support/test';

const scan = async (page: Page, testInfo: TestInfo) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  expect(results.violations).toEqual([]);
};

const waitForDialogAnimations = async (page: Page) => {
  await page
    .getByTestId('dialog-frame')
    .last()
    .evaluate((frame) => Promise.all(frame.getAnimations({ subtree: true }).map((animation) => animation.finished)));
};

test.describe('Route accessibility', () => {
  // Keep accessible-name/description probes and axe on separate pages to avoid Firefox Juggler crashes.
  test('login error alert is accessible and restores keyboard focus', async ({ page }) => {
    const signIn = createSignInPage(page);
    const messageDialog = createMessageDialog(page);
    await signIn.visit();
    await signIn.fillUsername('missing-dialog-test-user');
    await signIn.fillToken('invalid-test-token');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/auth/sign-in')
    );
    await signIn.getSubmitButton().press('Enter');
    expect((await responsePromise).ok()).toBe(false);
    await expect(messageDialog.getDialog()).toHaveAttribute('role', 'alertdialog');
    await expect(messageDialog.getDialog()).toHaveAccessibleName('Alert');
    await expect(messageDialog.getMessage()).not.toBeEmpty();
    await expect(messageDialog.getInput()).toHaveCount(0);
    await expect(messageDialog.getCancelButton()).toHaveCount(0);
    await waitForDialogAnimations(page);
    await page.keyboard.press('Escape');
    await expect(messageDialog.getDialogHost()).toHaveCount(0);
    await expect(signIn.getSubmitButton()).toBeFocused();
  });

  test('login error alert has no automated accessibility violations', async ({ page }, testInfo) => {
    const signIn = createSignInPage(page);
    const messageDialog = createMessageDialog(page);
    await signIn.visit();
    await signIn.fillUsername('missing-dialog-test-user');
    await signIn.fillToken('invalid-test-token');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/v1/auth/sign-in')
    );
    await signIn.getSubmitButton().press('Enter');
    expect((await responsePromise).ok()).toBe(false);
    await expect(messageDialog.getDialog()).toBeVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('public health has no automated accessibility violations', async ({ page }, testInfo) => {
    const healthPage = createHealthPage(page);
    await healthPage.visit();
    await expect(healthPage.getDiagnosticsUnauthorized()).toBeVisible();
    await expect(healthPage.getStatusBanner()).toBeVisible();
    await scan(page, testInfo);
  });

  test('authenticated health has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const healthPage = createHealthPage(page);
    await healthPage.visit();
    await expect(healthPage.getMetricsGrid()).toBeVisible();
    await scan(page, testInfo);
  });

  test('library has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const collectionPage = createCollectionPage(page);
    await collectionPage.visit();
    await expect(collectionPage.getEmptyState()).toBeVisible();
    await scan(page, testInfo);
  });

  test('add item dialog has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const collectionPage = createCollectionPage(page);
    await collectionPage.openNewItemDialog();
    await expect(collectionPage.getNewItemSearchInput()).toBeVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('item detail dialog has no automated accessibility violations', async ({ page, autoLogin, api }, testInfo) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Accessibility Movie'));
    const collectionPage = createCollectionPage(page);
    await collectionPage.visit();
    await collectionPage.getListItemImages().first().click();
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await collectionPage.expectItemDialogActionsVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('typed confirmation is accessible, traps keyboard focus, and preserves its parent on cancel', async ({
    page,
    autoLogin,
    api,
  }) => {
    const title = 'Typed Confirmation Movie';
    await autoLogin();
    expect((await api.request('POST', '/api/v1/collection-items', buildCollectionItem(title))).status()).toBe(200);
    const collectionPage = createCollectionPage(page);
    const messageDialog = createMessageDialog(page);
    await collectionPage.visit();
    await collectionPage.getListItemImages().first().press('Enter');
    const deleteButton = collectionPage.getItemDialogDeleteButton();
    await collectionPage.openItemActions();
    await deleteButton.press('Enter');
    await expect(messageDialog.getDialog()).toHaveAttribute('role', 'alertdialog');
    await expect(messageDialog.getDialog()).toHaveAttribute('aria-modal', 'true');
    await expect(messageDialog.getDialog()).toHaveAccessibleName(/Confirm action/);
    await expect(messageDialog.getDialog()).toHaveAccessibleDescription(new RegExp(title));
    await expect(collectionPage.getItemDialogComponentHost()).toHaveAttribute('inert', '');
    await expect(collectionPage.getItemDialogComponentHost()).toHaveAttribute('aria-hidden', 'true');
    await expect(messageDialog.getDialog()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(messageDialog.getInput()).toBeFocused();
    await expect(messageDialog.getInput()).toHaveAccessibleName(`Type "${title}" to confirm`);
    await expect(messageDialog.getConfirmButton()).toBeDisabled();
    await messageDialog.getInput().fill(title.toLowerCase());
    await expect(messageDialog.getConfirmButton()).toBeDisabled();
    await messageDialog.getInput().fill(`${title} `);
    await expect(messageDialog.getConfirmButton()).toBeDisabled();
    await messageDialog.getInput().fill(title);
    await expect(messageDialog.getConfirmButton()).toBeEnabled();
    await waitForDialogAnimations(page);
    await page.keyboard.press('Tab');
    await expect(messageDialog.getCancelButton()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(messageDialog.getConfirmButton()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(messageDialog.getInput()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(messageDialog.getConfirmButton()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(messageDialog.getDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogHost()).toBeVisible();
    await expect(collectionPage.getItemDialogComponentHost()).not.toHaveAttribute('inert', '');
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();

    await collectionPage.openItemActions();
    await deleteButton.press('Enter');
    await messageDialog.getCancelButton().press('Enter');
    await expect(messageDialog.getDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogMoreButton()).toBeFocused();
    await expect(collectionPage.getItemDialogHost()).toContainText(title);

    await collectionPage.openItemActions();
    await deleteButton.press('Enter');
    await messageDialog.getInput().fill(title);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().includes('/api/v1/collection-items/')
    );
    await messageDialog.getInput().press('Tab');
    await page.keyboard.press('Tab');
    await expect(messageDialog.getConfirmButton()).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await responsePromise).status()).toBe(204);
    await expect(collectionPage.getItemDialogHost()).toHaveCount(0);
    await expect(collectionPage.getEmptyState()).toBeVisible();
  });

  test('typed confirmation has no automated accessibility violations', async ({ page, autoLogin, api }, testInfo) => {
    const title = 'Typed Confirmation Movie';
    await autoLogin();
    expect((await api.request('POST', '/api/v1/collection-items', buildCollectionItem(title))).status()).toBe(200);
    const collectionPage = createCollectionPage(page);
    const messageDialog = createMessageDialog(page);
    await collectionPage.visit();
    await collectionPage.getListItemImages().first().press('Enter');
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogDeleteButton().press('Enter');
    await messageDialog.getInput().fill(title);
    await expect(messageDialog.getConfirmButton()).toBeEnabled();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('discard confirmation supports keyboard cancellation and restores draft focus', async ({
    page,
    autoLogin,
    api,
  }, testInfo) => {
    await autoLogin();
    await api.request('POST', '/api/v1/collection-items', buildCollectionItem('Confirmation Draft Movie'));
    const collectionPage = createCollectionPage(page);
    const messageDialog = createMessageDialog(page);
    await collectionPage.visit();
    await collectionPage.getListItemImages().first().press('Enter');
    await collectionPage.openItemActions();
    await collectionPage.getItemDialogEditButton().press('Enter');
    await collectionPage.getItemDialogTitleInput().fill('Preserved Draft');
    await collectionPage.getItemDialogReadOnlyButton().press('Enter');
    await expect(messageDialog.getDialog()).toHaveAttribute('role', 'alertdialog');
    await expect(messageDialog.getInput()).toHaveCount(0);
    await expect(messageDialog.getConfirmButton()).toBeEnabled();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
    await messageDialog.getCancelButton().press('Enter');
    await expect(messageDialog.getDialogHost()).toHaveCount(0);
    await expect(collectionPage.getItemDialogReadOnlyButton()).toBeFocused();
    await expect(collectionPage.getItemDialogTitleInput()).toHaveValue('Preserved Draft');
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'PUT' && response.url().includes('/api/v1/collection-items/')
    );
    await collectionPage.getItemDialogSaveButton().press('Enter');
    expect((await responsePromise).status()).toBe(200);
    await expect(collectionPage.getItemDialogHost()).toContainText('Preserved Draft');
  });

  test('information dialog is accessible and restores focus to its nested parent', async ({ page, autoLogin }) => {
    await page.route('**/api/v1/ai/availability', (route) =>
      route.fulfill({ status: 200, json: { data: { aiAvailable: true } } })
    );
    await autoLogin();
    const collectionPage = createCollectionPage(page);
    const messageDialog = createMessageDialog(page);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('Preserved AI prompt');
    await collectionPage.getAiSearchInfoButton().press('Enter');
    await expect(messageDialog.getDialog()).toHaveAttribute('role', 'dialog');
    await expect(messageDialog.getDialog()).toHaveAccessibleName(/Information/);
    await expect(messageDialog.getMessage()).not.toBeEmpty();
    await expect(messageDialog.getCancelButton()).toHaveCount(0);
    await waitForDialogAnimations(page);
    await messageDialog.getConfirmButton().press('Enter');
    await expect(messageDialog.getDialogHost()).toHaveCount(0);
    await expect(collectionPage.getAiSearchInfoButton()).toBeFocused();
    await expect(collectionPage.getAiSearchTextarea()).toHaveValue('Preserved AI prompt');
  });

  test('information dialog has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await page.route('**/api/v1/ai/availability', (route) =>
      route.fulfill({ status: 200, json: { data: { aiAvailable: true } } })
    );
    await autoLogin();
    const collectionPage = createCollectionPage(page);
    const messageDialog = createMessageDialog(page);
    await collectionPage.openAiSearchDialog();
    await collectionPage.getAiSearchTextarea().fill('Preserved AI prompt');
    await collectionPage.getAiSearchInfoButton().press('Enter');
    await expect(messageDialog.getDialog()).toBeVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('AI search dialog has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await page.route('**/api/v1/ai/availability', (route) =>
      route.fulfill({ status: 200, json: { data: { aiAvailable: true } } })
    );
    await autoLogin();
    const collectionPage = createCollectionPage(page);
    await collectionPage.openAiSearchDialog();
    await expect(collectionPage.getAiSearchTextarea()).toBeVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  test('mobile menu has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await autoLogin();
    const commonPage = createCommonPage(page);
    await commonPage.openMenu();
    await expect(commonPage.getNavCollectionLink()).toBeVisible();
    await waitForDialogAnimations(page);
    await scan(page, testInfo);
  });

  for (const width of [390, 1440]) {
    test(`account popup has no automated accessibility violations at ${width}px`, async ({
      page,
      autoLogin,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await autoLogin();
      const commonPage = createCommonPage(page);
      if (width < 1251) await commonPage.openMenu();
      await commonPage.openAccountMenu();
      await commonPage
        .getAccountMenu()
        .evaluate((dialog) =>
          Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished))
        );
      await scan(page, testInfo);
    });
  }

  test('settings basics has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const settingsPage = createSettingsPage(page);
    await settingsPage.visitBasics();
    await expect(settingsPage.getBasicsForm()).toBeVisible();
    await scan(page, testInfo);
  });

  test('statistics has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const statisticsPage = createStatisticsPage(page);
    await statisticsPage.visit();
    await expect(statisticsPage.getContent()).toBeVisible();
    await expect(statisticsPage.getEmptyMessage()).toBeVisible();
    await scan(page, testInfo);
  });

  test('about has no automated accessibility violations', async ({ page, autoLogin }, testInfo) => {
    await autoLogin();
    const aboutPage = createAboutPage(page);
    await aboutPage.visit();
    await expect(aboutPage.getTitle()).toBeVisible();
    await scan(page, testInfo);
  });
});
