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

  visitShares: () => {
    cy.visit('/client/#/settings/shares');
  },

  visitImages: () => {
    cy.visit('/client/#/settings/images');
  },

  visitGlobalWatchStatus: () => {
    cy.visit('/client/#/settings/global-watch-status');
  },

  // Basic form fields (always visible when settingsLock is off)
  getBasicsForm: () => cy.getByTestId('settings-basics-form'),
  getLanguageSelect: () => cy.getByTestId('settings-language').find('select'),
  getThemeSelect: () => cy.getByTestId('settings-theme').scrollIntoView().find('select'),
  getAnimatedBackgroundCheckbox: () => cy.getByTestId('settings-animated-background').find('input[type="checkbox"]'),
  getAppModeSelect: () => cy.getByTestId('settings-app-mode').scrollIntoView().find('select'),
  getSettingsLockCheckbox: () => cy.getByTestId('settings-settings-lock').find('input[type="checkbox"]'),
  getSensitiveDataStorageSelect: () =>
    cy.getByTestId('settings-sensitive-data-storage').scrollIntoView().find('select'),
  getClearLocalStorageCheckbox: () =>
    cy.getByTestId('settings-clear-local-storage-after-logout').scrollIntoView().find('input[type="checkbox"]'),

  // Images page
  getImagesRefreshLibrarySelect: () => cy.getByTestId('settings-images-refresh-library').find('select'),
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

  // Shares page
  getShareCode: () => cy.getByTestId('share-code-card').find('.user-hash'),
  getAddShareUserHashInput: () => cy.getByTestId('add-share-user-hash').find('input'),
  getAddShareCanReadCheckbox: () => cy.getByTestId('add-share-can-read').find('input[type="checkbox"]'),
  getAddShareCanCreateCheckbox: () => cy.getByTestId('add-share-can-create').find('input[type="checkbox"]'),
  getAddShareCanUpdateCheckbox: () => cy.getByTestId('add-share-can-update').find('input[type="checkbox"]'),
  getAddShareCanDeleteCheckbox: () => cy.getByTestId('add-share-can-delete').find('input[type="checkbox"]'),
  getAddShareSubmitButton: () => cy.getByTestId('add-share-submit'),
  getOutgoingShareCanReadCheckbox: () => cy.getByTestId('share-can-read').find('input[type="checkbox"]'),
  getOutgoingShareCanCreateCheckbox: () => cy.getByTestId('share-can-create').find('input[type="checkbox"]'),
  getOutgoingShareCanUpdateCheckbox: () => cy.getByTestId('share-can-update').find('input[type="checkbox"]'),
  getOutgoingShareCanDeleteCheckbox: () => cy.getByTestId('share-can-delete').find('input[type="checkbox"]'),
  getRemoveShareButton: () => cy.getByTestId('remove-share'),
  getRevokeIncomingShareButton: () => cy.getByTestId('revoke-incoming-share'),
  getDefaultLibrarySelect: () => cy.getByTestId('settings-default-library').find('select'),

  // Token dialog (shown after creating a new user token or access token)
  getTokenDialogValue: () => cy.getByTestId('token-dialog-value'),
};
