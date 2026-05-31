export const CollectionPage = {
  visit: () => {
    cy.visit('/client/#/collection/library');
    cy.reload();
  },

  visitSeriesTracker: () => {
    cy.visit('/client/#/collection/series-tracker');
    cy.reload();
  },

  // Search
  getSearchInput: () => cy.getByTestId('collection-search').find('input'),

  // List
  getList: () => cy.getByTestId('collection-list'),
  getListItems: () => cy.getByTestId('list-item-title'),
  getFavoriteBadges: () => cy.getByTestId('list-item-favorite'),
  getSharedBadges: () => cy.getByTestId('list-item-shared'),
  getListItemUserRates: () => cy.getByTestId('list-item-user-rate'),
  getListItemImages: (options?: Partial<Cypress.Timeoutable>) => cy.get('[data-test-id="list-item-image"]', options),
  getAllItems: () => cy.getByTestId('list-item-title'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-item'),
  getAddFirstWishlistItemLink: () => cy.getByTestId('add-first-wishlist-item'),
  getAddFirstSeriesTrackerItemLink: () => cy.getByTestId('add-first-series-tracker-item'),

  // Float buttons
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getRandomPickButton: () => cy.getByTestId('random-pick'),
  getScrollToTopButton: () => cy.getByTestId('scroll-to-top'),
  getAiSearchToggleButton: () => cy.getByTestId('ai-search-toggle'),

  // AI search input
  getAiSearchTrigger: () => cy.getByTestId('ai-search-trigger'),
  getAiSearchTextarea: () => cy.getByTestId('ai-search-textarea').find('textarea'),
  getAiSearchSendButton: () => cy.getByTestId('ai-search-send'),

  // New item dialog
  getNewItemSearch: () => cy.get('[data-test-id="new-item-search"]'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemLibrarySelect: () => cy.getByTestId('new-item-library').find('select'),
  getNewItemContentSelect: () => cy.getByTestId('new-item-content-select').find('select'),
  getNewItemUserRateInput: () => cy.getByTestId('new-item-user-rate').find('input'),
  getNewItemSaveButton: () => cy.getByTestId('new-item-save'),
  getNewItemSaveAndNewButton: () => cy.getByTestId('new-item-save-and-new'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),

  // Item dialog
  getItemDialogEditButton: () => cy.getByTestId('item-dialog-edit'),
  getItemDialogReadOnlyButton: () => cy.getByTestId('item-dialog-read-only'),
  getItemDialogSaveButton: () => cy.getByTestId('item-dialog-save'),
  getItemDialogDeleteButton: () => cy.getByTestId('item-dialog-delete'),
  openItemDialogActionsMenu: () => cy.getByTestId('dialog-actions-menu-button').click(),
  getItemDialogMarkFavoriteButton: () => cy.getByTestId('item-dialog-mark-favorite'),
  getItemDialogRemoveFavoriteButton: () => cy.getByTestId('item-dialog-remove-favorite'),
  getItemDialogMarkWatchedButton: () => cy.getByTestId('item-dialog-mark-watched'),
  getItemDialogMarkUnwatchedButton: () => cy.getByTestId('item-dialog-mark-unwatched'),
  getItemDialogSharedLibraryBadge: () => cy.getByTestId('item-dialog-shared-library'),
  getItemDialogUserRateChip: () => cy.getByTestId('item-dialog-user-rate-chip'),
  getItemDialogTitleInput: () => cy.getByTestId('item-dialog-title').find('input'),
  getItemDialogYearInput: () => cy.getByTestId('item-dialog-year').find('input'),
  getItemDialogUserRateInput: () => cy.getByTestId('item-dialog-user-rate').find('input'),
  getItemDialogWatchedUpToSeasonSelect: () => cy.getByTestId('item-dialog-watched-up-to-season').find('select'),
  getItemDialogWatchedUpToEpisodeSelect: () => cy.getByTestId('item-dialog-watched-up-to-episode').find('select'),
  getItemDialogEpisodeProgressChip: () => cy.getByTestId('item-dialog-episode-progress-chip'),
  getItemDialogRefreshSeriesMetadataButton: () => cy.getByTestId('item-dialog-refresh-series-metadata'),
  getItemDialogManageSeriesMetadataButton: () => cy.getByTestId('item-dialog-manage-series-metadata'),
  getItemDialogRemoveSeriesMetadataButton: () => cy.getByTestId('item-dialog-remove-series-metadata'),
  getItemDialogGenreInput: () => cy.getByTestId('item-dialog-genre').find('input'),
  getItemDialogTagsInput: () => cy.getByTestId('item-dialog-tags').find('input'),
  getItemDialogActorsInput: () => cy.getByTestId('item-dialog-actors').find('input'),
  getItemDialogPlotInput: () => cy.getByTestId('item-dialog-plot').find('textarea'),

  // Series metadata dialog
  getSeriesMetadataMessage: () => cy.getByTestId('series-metadata-message'),
  getSeriesMetadataAddButton: () => cy.getByTestId('series-metadata-add'),
  getSeriesMetadataCloseButton: () => cy.getByTestId('series-metadata-close'),
  getSeriesMetadataSaveButton: () => cy.getByTestId('series-metadata-save'),
  getSeriesMetadataValidation: () => cy.getByTestId('series-metadata-validation'),
  getSeriesMetadataSeasonInputs: () => cy.getByTestId('series-metadata-season').find('input'),
  getSeriesMetadataEpisodeInputs: () => cy.getByTestId('series-metadata-episodes').find('input'),
  getSeriesMetadataRemoveButtons: () => cy.getByTestId('series-metadata-remove'),
};
