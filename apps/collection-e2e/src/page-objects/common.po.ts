import type { Page } from '@playwright/test';

export const createCommonPage = (page: Page) => {
  const getMenuDialog = () => page.getByTestId('dialog-frame').filter({ has: page.getByTestId('navigation-brand') });
  const getNavLink = (testId: string) => getMenuDialog().getByTestId(testId);
  const getAccountTrigger = () => page.getByTestId('nav-profile').filter({ visible: true });
  const getAccountMenu = () => page.getByTestId('nav-account-more-actions').filter({ visible: true });
  const openAccountMenu = async () => {
    await getAccountTrigger().click();
    await getAccountMenu().waitFor();
  };

  return {
    getMenuDialog,
    getMenuButton: () => page.getByTestId('nav-menu-button'),
    getAccountTrigger,
    getAccountMenu,
    openAccountMenu,
    getVisibleNavItem: (testId: string) => page.getByTestId(testId).filter({ visible: true }),
    getAccountDivider: () => getAccountMenu().getByTestId('nav-account-destructive-divider'),
    getAccountCloseButton: () => getAccountMenu().getByTestId('nav-account-more-close'),
    openMenu: async () => {
      await page.getByTestId('nav-menu-button').click();
      await getMenuDialog().waitFor();
    },
    closeMenu: async () => {
      await page.getByTestId('dialog-overlay').click({ force: true });
      await getMenuDialog().waitFor({ state: 'detached' });
    },
    getNavCollectionLink: () => getNavLink('nav-collection'),
    getNavUpNextLink: () => getNavLink('nav-up-next'),
    getNavWishlistLink: () => getNavLink('nav-wishlist'),
    getNavTrackingLink: () => getNavLink('nav-tracking'),
    getNavBooksLink: () => getNavLink('nav-collection'),
    getMenuNavItem: getNavLink,
    getNavSettingsLink: () => getAccountMenu().getByTestId('nav-settings'),
    getNavStatisticsLink: () => getNavLink('nav-statistics'),
    getNavAboutLink: () => getAccountMenu().getByTestId('nav-about'),
    getNavLogoutLink: () => getAccountMenu().getByTestId('nav-logout'),
    navigateToSettingsViaMenu: async () => {
      await page.getByTestId('nav-menu-button').click();
      await openAccountMenu();
      await getAccountMenu().getByTestId('nav-settings').click();
    },
  };
};
