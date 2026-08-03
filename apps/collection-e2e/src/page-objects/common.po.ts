const getNavLink = (testId: string) =>
  cy.get(`ct-menu-dialog [data-test-id="${testId}"]`).scrollIntoView().should('be.visible');

export const CommonPage = {
  openMenu: () => {
    cy.getByTestId('nav-menu-button').should('be.visible').click();
    cy.get('ct-menu-dialog').should('exist');
  },
  closeMenu: () => {
    cy.getByTestId('dialog-overlay').click({ force: true });
    cy.get('ct-menu-dialog').should('not.exist');
  },
  getNavCollectionLink: () => getNavLink('nav-collection'),
  getNavWatchLaterLink: () => getNavLink('nav-watch-later'),
  getNavWishlistLink: () => getNavLink('nav-wishlist'),
  getNavSeriesTrackerLink: () => getNavLink('nav-series-tracker'),
  getNavMovieTrackerLink: () => getNavLink('nav-movie-tracker'),
  getNavBookTrackerLink: () => getNavLink('nav-book-tracker'),
  getMenuNavItem: (testId: string) => cy.get(`ct-menu-dialog [data-test-id="${testId}"]`),
  getNavSyncLink: () => getNavLink('nav-sync'),
  getNavSettingsLink: () => getNavLink('nav-settings'),
  getNavStatisticsLink: () => getNavLink('nav-statistics'),

  getNavAboutLink: () => getNavLink('nav-about'),
  getNavLogoutLink: () => getNavLink('nav-logout'),

  navigateToSettingsViaMenu: () => {
    CommonPage.openMenu();
    CommonPage.getNavSettingsLink().click();
  },
};
