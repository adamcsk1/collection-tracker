import { createSettingsPage } from '../page-objects/settings.po';
import { expect, test } from '../support/test';

let settingsPage: ReturnType<typeof createSettingsPage>;

test.beforeEach(async ({ page }) => {
  settingsPage = createSettingsPage(page);
});

test.describe('Companion app settings', () => {
  test.beforeEach(async ({ autoLogin }) => {
    await autoLogin();
  });

  test('hides native settings in ordinary browsers', async () => {
    await settingsPage.visitBasics();
    await expect(settingsPage.getNavToggle()).toHaveCount(1);
    await expect(settingsPage.getCompanionAppSettings()).toHaveCount(0);
  });

  test('opens native settings from the mobile settings menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const testWindow = window as Window & { __playwrightShowSettingsCallCount?: number };
      testWindow.__playwrightShowSettingsCallCount = 0;
      Object.defineProperty(window, 'CollectionTrackerInterface', {
        value: {
          showSettings: () => {
            testWindow.__playwrightShowSettingsCallCount = (testWindow.__playwrightShowSettingsCallCount ?? 0) + 1;
          },
        },
      });
    });
    await page.reload();
    await settingsPage.visitBasics();
    await settingsPage.getNavToggle().click();
    const companionAppSettings = settingsPage.getCompanionAppSettings();
    await companionAppSettings.scrollIntoViewIfNeeded();
    await expect(companionAppSettings).toBeVisible();
    await companionAppSettings.click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __playwrightShowSettingsCallCount?: number }).__playwrightShowSettingsCallCount
        )
      )
      .toBe(1);
    await expect(settingsPage.getNavToggle()).toHaveAttribute('aria-expanded', 'false');
  });
});
