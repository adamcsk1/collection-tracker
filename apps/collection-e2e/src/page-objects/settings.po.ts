import type { Page } from '@playwright/test';

export const createSettingsPage = (page: Page) => ({
  getCompanionAppSettings: () => page.getByTestId('settings-nav-companion-app'),
  getNavToggle: () => page.getByTestId('settings-nav-toggle'),
  visitBasics: async () => {
    await page.goto('/client/#/settings/basics');
  },

  visitAccount: async () => {
    await page.goto('/client/#/settings/account');
  },

  visitAccessTokens: async () => {
    await page.goto('/client/#/settings/access-tokens');
  },

  visitShares: async () => {
    await page.goto('/client/#/settings/shares');
  },

  visitMediaRefresh: async () => {
    await page.goto('/client/#/settings/media-refresh');
  },

  visitCollectionListDisplay: async () => {
    await page.goto('/client/#/settings/collection-list-display');
  },

  visitManageTrackerData: async () => {
    await page.goto('/client/#/settings/manage-tracker-data');
  },

  visitFeatures: async () => {
    await page.goto('/client/#/settings/features');
  },

  // Basic form fields (always visible when settingsLock is off)
  getBasicsForm: () => page.getByTestId('settings-basics-form'),
  getLanguageSelect: () => page.getByTestId('settings-language').locator('select'),
  getThemeSelect: () => page.getByTestId('settings-theme').locator('select'),
  getAnimatedBackgroundCheckbox: () =>
    page.getByTestId('settings-animated-background').locator('input[type="checkbox"]'),
  getAppModeSelect: () => page.getByTestId('settings-app-mode').locator('select'),
  getSettingsLockCheckbox: () => page.getByTestId('settings-settings-lock').locator('input[type="checkbox"]'),
  getSensitiveDataStorageSelect: () => page.getByTestId('settings-sensitive-data-storage').locator('select'),
  getClearLocalStorageCheckbox: () =>
    page.getByTestId('settings-clear-local-storage-after-logout').locator('input[type="checkbox"]'),

  // Collection list display page
  getCollectionListDisplayForm: () => page.getByTestId('settings-collection-list-display-form'),
  getListShowYearCheckbox: () => page.getByTestId('settings-list-show-year').locator('input[type="checkbox"]'),
  getListShowSharedIconCheckbox: () =>
    page.getByTestId('settings-list-show-shared-icon').locator('input[type="checkbox"]'),
  getListPreferredRatingSelect: () => page.getByTestId('settings-list-preferred-rating').locator('select'),
  getListImdbRatingFallbackCheckbox: () =>
    page.getByTestId('settings-list-imdb-rating-fallback').locator('input[type="checkbox"]'),

  // Features page
  getFeaturesForm: () => page.getByTestId('settings-features-form'),
  getFeatureWishlistCheckbox: () => page.getByTestId('settings-feature-wishlist').locator('input[type="checkbox"]'),
  getFeatureUpNextCheckbox: () => page.getByTestId('settings-feature-up-next').locator('input[type="checkbox"]'),
  getFeatureTrackingCheckbox: () => page.getByTestId('settings-feature-tracking').locator('input[type="checkbox"]'),
  getFeatureBooksCheckbox: () => page.getByTestId('settings-feature-books').locator('input[type="checkbox"]'),
  getFeatureMusicCheckbox: () => page.getByTestId('settings-feature-music').locator('input[type="checkbox"]'),

  // Media refresh page
  getMediaRefreshLibrarySelect: () => page.getByTestId('settings-media-refresh-library').locator('select'),
  findMediaRefreshLibrarySelect: () =>
    page.locator('body').locator('[data-test-id="settings-media-refresh-library"] select'),
  getImageRefreshStartButton: () => page.getByTestId('settings-images-refresh-start'),
  getExternalRatingsRefreshStartButton: () => page.getByTestId('settings-external-ratings-refresh-start'),
  getImageRefreshStatus: () => page.getByTestId('settings-image-refresh-status'),

  // Manage tracker data page
  getMarkAllCompletedButton: () => page.getByTestId('settings-mark-all-completed'),
  getMarkAllUncompletedButton: () => page.getByTestId('settings-mark-all-uncompleted'),
  getMarkAllSeriesCompletedButton: () => page.getByTestId('settings-mark-all-series-completed'),
  getMarkAllSeriesUncompletedButton: () => page.getByTestId('settings-mark-all-series-uncompleted'),
  getMarkAllBooksCompletedButton: () => page.getByTestId('settings-mark-all-books-completed'),
  getMarkAllBooksUncompletedButton: () => page.getByTestId('settings-mark-all-books-uncompleted'),
  getRemoveAllTrackedMovieDataButton: () => page.getByTestId('settings-remove-all-tracked-movie-data'),
  getRemoveAllTrackedSeriesDataButton: () => page.getByTestId('settings-remove-all-tracked-series-data'),
  getRemoveAllTrackedBookDataButton: () => page.getByTestId('settings-remove-all-tracked-book-data'),
  getRemoveAllTrackedMusicDataButton: () => page.getByTestId('settings-remove-all-tracked-music-data'),

  // Account Actions page
  getAccountActionsSection: () => page.getByTestId('settings-account-actions'),
  getCreateUserTokenButton: () => page.getByTestId('settings-create-user-token'),
  getDeleteUserButton: () => page.getByTestId('settings-delete-user'),

  // Access Tokens page
  getAccessTokensSection: () => page.getByTestId('settings-access-tokens'),
  getCreateAccessTokenButton: () => page.getByTestId('settings-create-access-token'),
  getRevokeTokenButton: (tokenHash: string) => page.getByTestId(`settings-revoke-token-${tokenHash}`),

  // Shares page
  getShareCode: () => page.getByTestId('share-code-card').locator('.user-hash'),
  getAddShareOpenButton: () => page.getByTestId('add-share-open'),
  getShareDialog: () => page.getByTestId('share-dialog').getByTestId('dialog-frame'),
  getShareDialogTitle: () => page.getByTestId('share-dialog-title'),
  getShareDialogMessage: () => page.getByTestId('share-dialog-message'),
  getShareDialogDependency: () => page.getByTestId('share-dialog-dependency'),
  getShareDialogUserHashInput: () => page.getByTestId('share-dialog-user-hash').locator('input'),
  getShareDialogGrants: () => page.getByTestId('share-dialog-grants'),
  getAddShareGrantCheckbox: (
    listType: string,
    contentType: string,
    permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
  ) =>
    page.getByTestId(`share-dialog-grant-${listType}-${contentType}-${permission}`).locator('input[type="checkbox"]'),
  getShareDialogSaveButton: () => page.getByTestId('share-dialog-save'),
  closeShareDialogByOverlay: async () => {
    await page
      .getByTestId('share-dialog')
      .last()
      .getByTestId('dialog-overlay')
      .click({ position: { x: 10, y: 10 } });
  },
  getEditShareButton: (shareCode: string) => page.getByTestId(`edit-share-${shareCode}`),
  getOutgoingShareGrantCheckbox: (
    listType: string,
    contentType: string,
    permission: 'can-read' | 'can-create' | 'can-update' | 'can-delete'
  ) =>
    page.getByTestId(`share-dialog-grant-${listType}-${contentType}-${permission}`).locator('input[type="checkbox"]'),
  getClearSelectedShareButton: (listType: string, contentType: string) =>
    page.getByTestId(`share-dialog-grant-${listType}-${contentType}-clear-selected`),
  getRemoveShareButton: (shareCode: string) => page.getByTestId(`remove-share-${shareCode}`),
  getRevokeIncomingShareButton: (shareCode: string) => page.getByTestId(`revoke-incoming-share-${shareCode}`),
  getViewIncomingShareButton: (shareCode: string) => page.getByTestId(`view-incoming-share-${shareCode}`),
  getIncomingShareDefaultCheckbox: (listType: string, contentType: string) =>
    page.getByTestId(`share-dialog-default-${listType}-${contentType}`).locator('input[type="checkbox"]'),
  getManageTrackerLibrarySelect: () => page.getByTestId('settings-manage-tracker-data-library').locator('select'),

  // Token dialog (shown after creating a new user token or access token)
  getTokenDialogValue: () => page.getByTestId('token-dialog-value'),
});
