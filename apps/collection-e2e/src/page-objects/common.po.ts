export const CommonPage = {
  openMenu: () => cy.getByTestId('nav-menu-button').click(),
  getNavMenuButton: () => cy.getByTestId('nav-menu-button'),
  getNavCollectionLink: () => cy.getByTestId('nav-collection'),
  getNavSyncLink: () => cy.getByTestId('nav-sync'),
  getNavSettingsLink: () => cy.getByTestId('nav-settings'),
  getNavTagsLink: () => cy.getByTestId('nav-tags'),
  getNavAboutLink: () => cy.getByTestId('nav-about'),
  getNavLogoutLink: () => cy.getByTestId('nav-logout'),

  navigateToSettingsViaMenu: () => {
    cy.getByTestId('nav-menu-button').click();
    cy.getByTestId('nav-settings').click();
  },
};
