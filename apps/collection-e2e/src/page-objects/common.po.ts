export const CommonPage = {
  openMenu: () => {
    cy.getByTestId('nav-menu-button').then(($btn) => {
      if ($btn.is(':visible')) {
        cy.wrap($btn).click();
      }
    });
  },
  getNavCollectionLink: () => cy.getByTestId('nav-collection'),
  getNavFavoritesLink: () => cy.getByTestId('nav-favorites'),
  getNavWatchLaterLink: () => cy.getByTestId('nav-watch-later'),
  getNavWishlistLink: () => cy.getByTestId('nav-wishlist'),
  getNavSeriesTrackerLink: () => cy.getByTestId('nav-series-tracker'),
  getNavMovieTrackerLink: () => cy.getByTestId('nav-movie-tracker'),
  getNavSyncLink: () => cy.getByTestId('nav-sync'),
  getNavSettingsLink: () => cy.getByTestId('nav-settings'),
  getNavStatisticsLink: () => cy.getByTestId('nav-statistics'),

  getNavAboutLink: () => cy.getByTestId('nav-about'),
  getNavLogoutLink: () => cy.getByTestId('nav-logout'),

  navigateToSettingsViaMenu: () => {
    CommonPage.openMenu();
    cy.getByTestId('nav-settings').click();
  },
};
