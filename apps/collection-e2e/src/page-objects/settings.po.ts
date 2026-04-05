export const SettingsPage = {
  visit: () => {
    cy.visit('/client/#/settings');
  },

  // Basic form fields (always visible when settingsLock is off)
  getLanguageSelect: () => cy.getByTestId('settings-language').find('select'),
  getThemeSelect: () => cy.getByTestId('settings-theme').scrollIntoView().find('select'),
  getAnimatedBackgroundCheckbox: () => cy.getByTestId('settings-animated-background').find('input[type="checkbox"]'),
  getAppModeSelect: () => cy.getByTestId('settings-app-mode').scrollIntoView().find('select'),
  getSettingsLockCheckbox: () => cy.getByTestId('settings-settings-lock').find('input[type="checkbox"]'),
  getFetchBatchSizeSelect: () => cy.getByTestId('settings-fetch-batch-size').find('select'),
  getSensitiveDataStorageSelect: () =>
    cy.getByTestId('settings-sensitive-data-storage').scrollIntoView().find('select'),
  getClearLocalStorageCheckbox: () =>
    cy.getByTestId('settings-clear-local-storage-after-logout').scrollIntoView().find('input[type="checkbox"]'),

  // Save buttons
  getSaveButton: () => cy.getByTestId('settings-save').scrollIntoView(),
  getSaveAndBackButton: () => cy.getByTestId('settings-save-and-back').scrollIntoView(),

  // Others section - only visible when appMode is 'full'
  getImagesRefreshStartButton: () => cy.getByTestId('settings-images-refresh-start').scrollIntoView(),
  getMarkAllWatchedButton: () => cy.getByTestId('settings-mark-all-watched').scrollIntoView(),
  getMarkAllUnwatchedButton: () => cy.getByTestId('settings-mark-all-unwatched').scrollIntoView(),

  // Account Actions - only visible when settingsLock is off
  getAccountActionsSection: () => cy.getByTestId('settings-account-actions'),
  getCreateUserTokenButton: () => cy.getByTestId('settings-create-user-token').scrollIntoView(),
  getDeleteUserButton: () => cy.getByTestId('settings-delete-user').scrollIntoView(),

  // Access Tokens - only visible when settingsLock is off
  getAccessTokensSection: () => cy.getByTestId('settings-access-tokens'),
  getCreateAccessTokenButton: () => cy.getByTestId('settings-create-access-token').scrollIntoView(),
  getRevokeTokenButton: (tokenHash: string) => cy.getByTestId(`settings-revoke-token-${tokenHash}`).scrollIntoView(),

  // Token dialog (shown after creating a new user token or access token)
  getTokenDialogValue: () => cy.getByTestId('token-dialog-value'),
  getTokenDialogCopyButton: () => cy.getByTestId('token-dialog-copy'),

};
