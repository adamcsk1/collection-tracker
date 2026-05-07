export const SettingsPage = {
  visitBasics: () => {
    cy.visit('/client/#/settings/basics');
  },

  visitAccount: () => {
    cy.visit('/client/#/settings/account');
  },

  visitAccessTokens: () => {
    cy.visit('/client/#/settings/access-tokens');
  },

  visitImages: () => {
    cy.visit('/client/#/settings/images');
  },

  visitGlobalWatchStatus: () => {
    cy.visit('/client/#/settings/global-watch-status');
  },

  // Basic form fields (always visible when settingsLock is off)
  getLanguageSelect: () => cy.getByTestId('settings-language').find('select'),
  getThemeSelect: () => cy.getByTestId('settings-theme').scrollIntoView().find('select'),
  getAnimatedBackgroundCheckbox: () => cy.getByTestId('settings-animated-background').find('input[type="checkbox"]'),
  getAppModeSelect: () => cy.getByTestId('settings-app-mode').scrollIntoView().find('select'),
  getSettingsLockCheckbox: () => cy.getByTestId('settings-settings-lock').find('input[type="checkbox"]'),
  getSensitiveDataStorageSelect: () =>
    cy.getByTestId('settings-sensitive-data-storage').scrollIntoView().find('select'),
  getClearLocalStorageCheckbox: () =>
    cy.getByTestId('settings-clear-local-storage-after-logout').scrollIntoView().find('input[type="checkbox"]'),

  // Save button
  getSaveButton: () => cy.getByTestId('settings-save').scrollIntoView(),

  // Images page
  getImagesRefreshStartButton: () => cy.getByTestId('settings-images-refresh-start').scrollIntoView(),

  // Global watch status page
  getMarkAllWatchedButton: () => cy.getByTestId('settings-mark-all-watched').scrollIntoView(),
  getMarkAllUnwatchedButton: () => cy.getByTestId('settings-mark-all-unwatched').scrollIntoView(),

  // Account Actions page
  getAccountActionsSection: () => cy.getByTestId('settings-account-actions'),
  getCreateUserTokenButton: () => cy.getByTestId('settings-create-user-token').scrollIntoView(),
  getDeleteUserButton: () => cy.getByTestId('settings-delete-user').scrollIntoView(),

  // Access Tokens page
  getAccessTokensSection: () => cy.getByTestId('settings-access-tokens'),
  getCreateAccessTokenButton: () => cy.getByTestId('settings-create-access-token').scrollIntoView(),
  getRevokeTokenButton: (tokenHash: string) => cy.getByTestId(`settings-revoke-token-${tokenHash}`).scrollIntoView(),

  // Token dialog (shown after creating a new user token or access token)
  getTokenDialogValue: () => cy.getByTestId('token-dialog-value'),
};
