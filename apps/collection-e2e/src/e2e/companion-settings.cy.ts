import { SettingsPage } from '../page-objects/settings.po';

describe('Companion app settings', () => {
  beforeEach(() => cy.autoLogin());

  it('hides native settings in ordinary browsers', () => {
    SettingsPage.visitBasics();
    SettingsPage.getNavToggle().should('exist');
    SettingsPage.getCompanionAppSettings().should('not.exist');
  });

  it('opens native settings from the mobile settings menu', () => {
    cy.viewport(390, 844);
    cy.window().then((window) => {
      Object.defineProperty(window, 'CollectionTrackerInterface', {
        value: { showSettings: cy.stub().as('showSettings') },
      });
    });
    SettingsPage.visitBasics();
    SettingsPage.getNavToggle().click();
    SettingsPage.getCompanionAppSettings().scrollIntoView().should('be.visible').click();
    cy.get('@showSettings').should('have.been.calledOnce');
    SettingsPage.getNavToggle().should('have.attr', 'aria-expanded', 'false');
  });
});
