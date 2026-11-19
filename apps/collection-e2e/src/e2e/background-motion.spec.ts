import type { Page } from '@playwright/test';
import { createSettingsPage } from '../page-objects/settings.po';
import { expect, test } from '../support/test';

const waitForSettingsSave = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/users/me/settings'
  );

test.beforeEach(async ({ page, autoLoginWithNewUser }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.route('**/api/v1/images/background', (route) =>
    route.fulfill({ json: { data: { images: ['https://example.com/background-motion.png'] } } })
  );
  await page.route(/\/api\/v1\/images\/proxy(?:\?|$)/, (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU1sAAAAASUVORK5CYII=',
        'base64'
      ),
    })
  );
  await autoLoginWithNewUser();
});

test('persists static posters, refreshes without enabling motion, and keeps visibility separate', async ({
  page,
  api,
}) => {
  const settingsPage = createSettingsPage(page);
  await settingsPage.visitBasics();

  await expect(settingsPage.getAnimatedBackgroundCheckbox()).toBeChecked();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeChecked();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', /image-animation$/);

  let saveResponse = waitForSettingsSave(page);
  await settingsPage.getBackgroundAnimationCheckbox().uncheck();
  expect((await saveResponse).status()).toBe(200);
  await expect(settingsPage.getPosterBackground()).toBeVisible();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');

  await settingsPage.reloadBasics();
  await expect(settingsPage.getAnimatedBackgroundCheckbox()).toBeChecked();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).not.toBeChecked();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');

  const refreshResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/v1/images/background'
  );
  await settingsPage.getRefreshBackgroundImagesButton().click();
  expect((await refreshResponse).status()).toBe(200);
  await expect(settingsPage.getBackgroundAnimationCheckbox()).not.toBeChecked();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');
  const storedSettings = await api.request('GET', '/api/v1/users/me/settings');
  expect(storedSettings.status()).toBe(200);
  expect((await storedSettings.json()).data).toEqual(
    expect.objectContaining({ animatedBackground: true, backgroundAnimation: false })
  );

  saveResponse = waitForSettingsSave(page);
  await settingsPage.getAnimatedBackgroundCheckbox().uncheck();
  expect((await saveResponse).status()).toBe(200);
  await expect(settingsPage.getPosterBackground()).toHaveCount(0);
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeDisabled();
  await expect(settingsPage.getRefreshBackgroundImagesButton()).toBeDisabled();

  await settingsPage.reloadBasics();
  await expect(settingsPage.getAnimatedBackgroundCheckbox()).not.toBeChecked();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeDisabled();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).not.toBeChecked();
  await expect(settingsPage.getPosterBackground()).toHaveCount(0);

  saveResponse = waitForSettingsSave(page);
  await settingsPage.getAnimatedBackgroundCheckbox().check();
  expect((await saveResponse).status()).toBe(200);
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeEnabled();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).not.toBeChecked();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');

  saveResponse = waitForSettingsSave(page);
  await settingsPage.getBackgroundAnimationCheckbox().check();
  expect((await saveResponse).status()).toBe(200);
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', /image-animation$/);
});

test('honors reduced motion on a mobile viewport without changing the saved animation preference', async ({
  page,
  api,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const settingsPage = createSettingsPage(page);
  await settingsPage.visitBasics();

  let saveResponse = waitForSettingsSave(page);
  await settingsPage.getBackgroundAnimationCheckbox().uncheck();
  expect((await saveResponse).status()).toBe(200);
  saveResponse = waitForSettingsSave(page);
  await settingsPage.getBackgroundAnimationCheckbox().check();
  expect((await saveResponse).status()).toBe(200);

  await settingsPage.reloadBasics();
  await expect(settingsPage.getAnimatedBackgroundCheckbox()).toBeChecked();
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeChecked();
  await expect(settingsPage.getPosterBackground()).toBeVisible();
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', /image-animation$/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(settingsPage.getPosterBackgroundImages().first()).toHaveCSS('animation-name', 'none');
  await expect(settingsPage.getBackgroundAnimationCheckbox()).toBeChecked();

  const storedSettings = await api.request('GET', '/api/v1/users/me/settings');
  expect(storedSettings.status()).toBe(200);
  expect((await storedSettings.json()).data).toEqual(
    expect.objectContaining({ animatedBackground: true, backgroundAnimation: true })
  );
});
