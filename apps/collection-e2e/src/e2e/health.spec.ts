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
  });
});
