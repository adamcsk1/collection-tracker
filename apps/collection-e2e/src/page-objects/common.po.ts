import type { Page } from '@playwright/test';

export const createCommonPage = (page: Page) => {
  const getNavLink = (testId: string) => page.locator(`ct-menu-dialog [data-test-id="${testId}"]`);

  return {
    openMenu: async () => {
      await page.getByTestId('nav-menu-button').click();
      await page.locator('ct-menu-dialog').waitFor();
    },
    closeMenu: async () => {
      await page.getByTestId('dialog-overlay').click({ force: true });
      await page.locator('ct-menu-dialog').waitFor({ state: 'detached' });
    },
    getNavCollectionLink: () => getNavLink('nav-collection'),
    getNavUpNextLink: () => getNavLink('nav-up-next'),
    getNavWishlistLink: () => getNavLink('nav-wishlist'),
    getNavTrackingLink: () => getNavLink('nav-tracking'),
    getNavBooksLink: () => getNavLink('nav-collection'),
    getMenuNavItem: (testId: string) => page.locator(`ct-menu-dialog [data-test-id="${testId}"]`),
    getNavSettingsLink: () => getNavLink('nav-settings'),
    getNavStatisticsLink: () => getNavLink('nav-statistics'),
    getNavAboutLink: () => getNavLink('nav-about'),
    getNavLogoutLink: () => getNavLink('nav-logout'),
    navigateToSettingsViaMenu: async () => {
      await page.getByTestId('nav-menu-button').click();
      await getNavLink('nav-settings').click();
    },
  };
};
