import { createCommonPage } from '../page-objects/common.po';
import { expect, test } from '../support/test';

for (const width of [1440, 2000]) {
  test(`desktop sidebar preserves content width at ${width}px`, async ({ page, autoLogin }) => {
    await page.setViewportSize({ width, height: 900 });
    await autoLogin();
    const common = createCommonPage(page);
    const account = await common.getAccountTrigger().boundingBox();
    const content = await page.getByTestId('main-content').boundingBox();
    if (!account || !content) throw new Error('Missing sidebar or content bounds');
    expect(account.x + account.width).toBeLessThan(350);
    expect(content.x).toBeLessThan(350);
    expect(content.width).toBeGreaterThan(width - 350);
  });
}

test('desktop account stays below primary navigation at the sidebar bottom', async ({ page, autoLogin }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await autoLogin();
  const common = createCommonPage(page);
  await expect(common.getMenuDialog()).toHaveCount(0);
  const primaryIds = ['nav-collection', 'nav-wishlist', 'nav-up-next', 'nav-tracking', 'nav-statistics'];
  let previousBottom = 0;
  for (const testId of primaryIds) {
    const link = common.getVisibleNavItem(testId);
    await expect(link).toHaveCount(1);
    await expect(link).toBeInViewport({ ratio: 1 });
    const bounds = await link.boundingBox();
    if (!bounds) throw new Error(`Missing navigation bounds: ${testId}`);
    expect(bounds.y).toBeGreaterThanOrEqual(previousBottom);
    previousBottom = bounds.y + bounds.height;
  }
  const account = common.getAccountTrigger();
  await expect(account).toBeInViewport({ ratio: 1 });
  const bounds = await account.boundingBox();
  if (!bounds) throw new Error('Missing sidebar account bounds');
  expect(bounds.x).toBeLessThan(350);
  expect(bounds.y).toBeGreaterThan(previousBottom + 100);
  expect(900 - bounds.y - bounds.height).toBeLessThan(80);
  for (const testId of ['nav-settings', 'nav-about', 'nav-logout']) {
    await expect(common.getVisibleNavItem(testId)).toHaveCount(0);
  }
  await testInfo.attach('desktop-bottom-account', { body: await page.screenshot(), contentType: 'image/png' });
  await common.openAccountMenu();
  await expect(common.getNavSettingsLink()).toHaveCount(1);
  await expect(common.getNavAboutLink()).toHaveCount(1);
  await expect(common.getNavLogoutLink()).toHaveCount(1);
  await expect(common.getAccountDivider()).toBeVisible();
});

for (const width of [390, 1000, 1440]) {
  test(`account keyboard dismissal preserves navigation and restores focus at ${width}px`, async ({
    page,
    autoLogin,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await autoLogin();
    const common = createCommonPage(page);
    if (width < 1251) {
      const menu = common.getMenuButton();
      await expect(menu).toBeInViewport({ ratio: 1 });
      const bounds = await menu.boundingBox();
      if (!bounds) throw new Error('Missing header menu bounds');
      expect(bounds.x).toBeGreaterThan(width - 80);
      expect(bounds.y).toBeLessThan(80);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(common.getMenuDialog()).toBeVisible();
    }
    const trigger = common.getAccountTrigger();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const popup = common.getAccountMenu();
    await expect(popup).toHaveAttribute('open', '');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await popup.evaluate((dialog) =>
      Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished))
    );
    const headingBounds = (await popup.getByTestId('nav-account-more-heading').locator('h3').boundingBox())!;
    const iconBounds = (await common.getNavSettingsLink().locator('i').boundingBox())!;
    expect(Math.abs(headingBounds.x - iconBounds.x)).toBeLessThanOrEqual(2);
    const bounds = await popup.boundingBox();
    if (!bounds) throw new Error('Missing account popup bounds');
    if (width <= 650) {
      expect(bounds.width).toBeCloseTo(width, 0);
      expect(bounds.y + bounds.height).toBeCloseTo(844, 0);
    } else {
      expect(bounds.width).toBeLessThan(500);
    }
    await common.getNavLogoutLink().focus();
    await page.keyboard.press('Tab');
    await expect(common.getAccountCloseButton()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(common.getNavLogoutLink()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(common.getAccountMenu()).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    if (width < 1251) {
      await expect(common.getMenuDialog()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(common.getMenuDialog()).toHaveCount(0);
      await expect(common.getMenuButton()).toBeFocused();
    } else {
      await expect(common.getVisibleNavItem('nav-collection')).toBeVisible();
    }
  });

  test(`account Settings and About actions close all navigation overlays at ${width}px`, async ({
    page,
    autoLogin,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await autoLogin();
    const common = createCommonPage(page);
    for (const destination of ['settings', 'about']) {
      if (width < 1251) await common.openMenu();
      await common.openAccountMenu();
      await (destination === 'settings' ? common.getNavSettingsLink() : common.getNavAboutLink()).click();
      await expect(page).toHaveURL(new RegExp(`/#/${destination}(?:/|$)`));
      await expect(common.getAccountMenu()).toHaveCount(0);
      await expect(common.getMenuDialog()).toHaveCount(0);
      await expect(page.getByTestId('main-content')).toBeVisible();
    }
  });
}

for (const width of [320, 1440]) {
  test(`short viewport keeps account trigger and actions reachable at ${width}px`, async ({ page, autoLogin }) => {
    await page.setViewportSize({ width, height: 256 });
    await autoLogin();
    const common = createCommonPage(page);
    if (width < 1251) await common.openMenu();
    await common.getAccountTrigger().scrollIntoViewIfNeeded();
    await expect(common.getAccountTrigger()).toBeInViewport({ ratio: 1 });
    await common.openAccountMenu();
    for (const control of [common.getNavSettingsLink(), common.getNavAboutLink(), common.getNavLogoutLink()]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 1 });
      await expect(control).toBeEnabled();
    }
    await common.getNavLogoutLink().press('Escape');
    await expect(common.getAccountTrigger()).toBeFocused();
    await expect(common.getAccountTrigger()).toBeInViewport({ ratio: 1 });
  });
}
