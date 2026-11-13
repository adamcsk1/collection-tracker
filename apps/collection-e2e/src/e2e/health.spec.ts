import AxeBuilder from '@axe-core/playwright';
import { createHealthPage } from '../page-objects/health.po';
import { expect, test } from '../support/test';

let healthPage: ReturnType<typeof createHealthPage>;

test.beforeEach(async ({ page }) => {
  healthPage = createHealthPage(page);
});

test.describe('Health page', () => {
  test('shows public status and login actions when signed out', async ({ page }) => {
    await healthPage.visit();
    await page.context().clearCookies();
    await healthPage.visit();
    await expect(healthPage.getLoginLink()).toBeVisible();
    await expect(healthPage.getLoginLink()).toHaveAttribute('href', '/login/');
    await expect(healthPage.getStatusBanner()).toBeVisible();
    await expect(healthPage.getStatusBanner()).toHaveAttribute('data-status', /^(ok|warn|error)$/);
    await expect(healthPage.getMetricsGrid()).toHaveCount(0);
    await expect(healthPage.getDiagnosticsUnauthorized()).toBeVisible();
  });

  test.describe('authenticated diagnostics', () => {
    test.beforeEach(async ({ autoLogin }) => {
      await autoLogin();
      await healthPage.visit();
    });

    test('renders authenticated diagnostics', async () => {
      await expect(healthPage.getStatusBanner()).toBeVisible();
      await expect(healthPage.getStatusBanner()).toHaveAttribute('data-status', /^(ok|warn|error)$/);
      await expect(healthPage.getMetricsGrid()).toBeVisible();
      await expect(healthPage.getMemoryCard()).toBeVisible();
      await expect(healthPage.getMemoryCard()).toContainText('%');
      await expect(healthPage.getCpuCard()).toBeVisible();
      await expect(healthPage.getCpuCard()).toContainText('%');
      await expect(healthPage.getMetadataCard()).toBeVisible();
      await expect(healthPage.getMetadataStatus()).toHaveAttribute('data-status', /^(up|down)$/);
      await expect(healthPage.getAiCard()).toBeVisible();
      await expect(healthPage.getAiStatus()).toHaveAttribute('data-status', /^(up|down)$/);
    });

    test('diagnostics contrast meets WCAG in both themes and service states', async ({ page }) => {
      await expect(healthPage.getMetricsGrid()).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(value);
        }, theme);
        for (const status of ['up', 'down']) {
          await healthPage
            .getMetadataStatus()
            .evaluate((element, value) => element.setAttribute('data-status', value), status);
          const results = await new AxeBuilder({ page })
            .include('[data-test-id="health-metrics-grid"]')
            .withRules('color-contrast')
            .analyze();
          expect(results.violations).toEqual([]);
        }
      }
    });
  });
});
