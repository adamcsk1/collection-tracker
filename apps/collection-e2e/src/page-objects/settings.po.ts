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

  visitMediaRefresh: () => {
    cy.visit('/client/#/settings/media-refresh');
  },

  visitCollectionListDisplay: () => {
    cy.visit('/client/#/settings/collection-list-display');
  },

  visitManageTrackerData: () => {
    cy.visit('/client/#/settings/manage-tracker-data');
  },

  visitFeatures: () => {
    cy.visit('/client/#/settings/features');
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

  // Collection list display page
  getCollectionListDisplayForm: () => cy.getByTestId('settings-collection-list-display-form'),
  getListShowYearCheckbox: () => cy.getByTestId('settings-list-show-year').find('input[type="checkbox"]'),
  getListShowSharedIconCheckbox: () => cy.getByTestId('settings-list-show-shared-icon').find('input[type="checkbox"]'),
  getListPreferredRatingSelect: () => cy.getByTestId('settings-list-preferred-rating').find('select'),
  getListImdbRatingFallbackCheckbox: () =>
    cy.getByTestId('settings-list-imdb-rating-fallback').find('input[type="checkbox"]'),

  // Features page
  getFeaturesForm: () => cy.getByTestId('settings-features-form'),
  getFeatureWishlistCheckbox: () => cy.getByTestId('settings-feature-wishlist').find('input[type="checkbox"]'),
  getFeatureUpNextCheckbox: () => cy.getByTestId('settings-feature-up-next').find('input[type="checkbox"]'),
  getFeatureTrackingCheckbox: () => cy.getByTestId('settings-feature-tracking').find('input[type="checkbox"]'),
  getFeatureBooksCheckbox: () => cy.getByTestId('settings-feature-books').find('input[type="checkbox"]'),

  // Media refresh page
  getMediaRefreshLibrarySelect: () => cy.getByTestId('settings-media-refresh-library').find('select'),
  findMediaRefreshLibrarySelect: () => cy.get('body').find('[data-test-id="settings-media-refresh-library"] select'),
  getImageRefreshStartButton: () => cy.getByTestId('settings-images-refresh-start').scrollIntoView(),
  getExternalRatingsRefreshStartButton: () =>
    cy.getByTestId('settings-external-ratings-refresh-start').scrollIntoView(),
  getImageRefreshStatus: () => cy.getByTestId('settings-image-refresh-status').scrollIntoView(),

  // Manage tracker data page
  getMarkAllCompletedButton: () => cy.getByTestId('settings-mark-all-completed').scrollIntoView(),
  getMarkAllUncompletedButton: () => cy.getByTestId('settings-mark-all-uncompleted').scrollIntoView(),
  getMarkAllSeriesCompletedButton: () => cy.getByTestId('settings-mark-all-series-completed').scrollIntoView(),
  getMarkAllSeriesUncompletedButton: () => cy.getByTestId('settings-mark-all-series-uncompleted').scrollIntoView(),
  getMarkAllBooksCompletedButton: () => cy.getByTestId('settings-mark-all-books-completed').scrollIntoView(),
  getMarkAllBooksUncompletedButton: () => cy.getByTestId('settings-mark-all-books-uncompleted').scrollIntoView(),
  getRemoveAllTrackedMovieDataButton: () => cy.getByTestId('settings-remove-all-tracked-movie-data').scrollIntoView(),
  getRemoveAllTrackedSeriesDataButton: () => cy.getByTestId('settings-remove-all-tracked-series-data').scrollIntoView(),
  getRemoveAllTrackedBookDataButton: () => cy.getByTestId('settings-remove-all-tracked-book-data').scrollIntoView(),

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
  getAddShareOpenButton: () => cy.getByTestId('add-share-open'),
  getShareDialog: () => cy.getByTestId('share-dialog').find('[data-test-id="dialog-frame"]'),
  getShareDialogUserHashInput: () => cy.getByTestId('share-dialog-user-hash').find('input'),
  getShareDialogGrants: () => cy.getByTestId('share-dialog-grants'),
  getAddShareGrantCheckbox: (
    listType: string,
    contentType: string,
    permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
  ) => cy.getByTestId(`share-dialog-grant-${listType}-${contentType}-${permission}`).find('input[type="checkbox"]'),
  getShareDialogSaveButton: () => cy.getByTestId('share-dialog-save'),
  getEditShareButton: (shareCode: string) => cy.getByTestId(`edit-share-${shareCode}`),
  getOutgoingShareGrantCheckbox: (
    listType: string,
    contentType: string,
    permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
  ) => cy.getByTestId(`share-dialog-grant-${listType}-${contentType}-${permission}`).find('input[type="checkbox"]'),
  getRemoveShareButton: (shareCode: string) => cy.getByTestId(`remove-share-${shareCode}`),
  getRevokeIncomingShareButton: (shareCode: string) => cy.getByTestId(`revoke-incoming-share-${shareCode}`),
  getViewIncomingShareButton: (shareCode: string) => cy.getByTestId(`view-incoming-share-${shareCode}`),
  getDefaultLibrarySelect: () => cy.getByTestId('settings-default-library').find('select'),
  getManageTrackerLibrarySelect: () => cy.getByTestId('settings-manage-tracker-data-library').find('select'),

  // Token dialog (shown after creating a new user token or access token)
  getTokenDialogValue: () => cy.getByTestId('token-dialog-value'),
};
