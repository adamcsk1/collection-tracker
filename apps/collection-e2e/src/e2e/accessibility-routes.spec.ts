import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { buildCollectionItem } from '../fixtures/collection-item';
import { createAboutPage } from '../page-objects/about.po';
import { createCollectionPage } from '../page-objects/collection.po';
import { createCommonPage } from '../page-objects/common.po';
import { createHealthPage } from '../page-objects/health.po';
import { createSettingsPage } from '../page-objects/settings.po';
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
    .evaluate((frame) => Promise.all(frame.getAnimations({ subtree: true }).map((animation) => animation.finished)));
};

test.describe('Route accessibility', () => {
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
