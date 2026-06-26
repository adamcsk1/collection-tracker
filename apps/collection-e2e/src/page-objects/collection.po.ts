const getActiveDialog = () => cy.get('.dialog').last();
const getDialogFrame = (subject: Cypress.Chainable<JQuery<HTMLElement>>) =>
  subject.find('[data-test-id="dialog-frame"]');
const getActiveDialogFrame = () => cy.getByTestId('dialog-frame').last();
const getItemDialog = () => getDialogFrame(cy.getByTestId('item-dialog').last());
const getSeriesMetadataDialog = () => getDialogFrame(cy.getByTestId('series-metadata-dialog').last());
const getWatchedEpisodesDialogHost = () => cy.getByTestId('watched-episodes-dialog');
const getWatchedEpisodesDialog = () => getWatchedEpisodesDialogHost().last();
const getDialogComponentHost = (testId: string) => cy.getByTestId(testId).last().parents('.dialog').first();
const swipeActiveDialog = (startX: number, endX: number) =>
  getActiveDialogFrame()
    .trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: startX,
      clientY: 180,
      force: true,
    })
    .trigger('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: endX,
      clientY: 184,
      force: true,
    });

export const CollectionPage = {
  visit: () => {
    cy.visit('/client/#/collection/library');
    cy.reload();
  },

  visitSeriesTracker: () => {
    cy.visit('/client/#/collection/series-tracker');
  },
  visitMovieTracker: () => {
    cy.visit('/client/#/collection/movie-tracker');
  },
  visitWatchLater: () => {
    cy.visit('/client/#/collection/watch-later');
  },

  // Search
  getSearchInput: () => cy.getByTestId('collection-search').find('input'),
  getSearchHost: () => cy.getByTestId('collection-search'),
  getSeriesTrackerSearchInput: () => cy.getByTestId('series-tracker-search').find('input'),
  getMovieTrackerSearchInput: () => cy.getByTestId('movie-tracker-search').find('input'),
  getWatchLaterSearchInput: () => cy.getByTestId('watch-later-search').find('input'),
  getWishlistSearchInput: () => cy.getByTestId('wishlist-search').find('input'),

  // List
  getList: () => cy.getByTestId('collection-list'),
  getListItems: (options: Partial<Cypress.Timeoutable> = { timeout: 10000 }) =>
    cy.getByTestId('list-item-title', options),
  getFavoriteBadges: () => cy.getByTestId('list-item-favorite'),
  getSeriesTrackerCompletedBadges: () => cy.getByTestId('list-item-series-tracker-completed'),
  getMovieTrackerWatchedBadges: () => cy.getByTestId('list-item-watched'),
  getSharedBadges: () => cy.getByTestId('list-item-shared'),
  getListItemYears: () => cy.getByTestId('list-item-year'),
  getListItemImdbRatings: () => cy.getByTestId('list-item-rating-imdb'),
  getListItemRottenTomatoesRatings: () => cy.getByTestId('list-item-rating-rotten-tomatoes'),
  getListItemMetacriticRatings: () => cy.getByTestId('list-item-rating-metacritic'),
  getListItemUserRates: () => cy.getByTestId('list-item-user-rate'),
  getListItemImages: (options?: Partial<Cypress.Timeoutable>) => cy.get('[data-test-id="list-item-image"]', options),
  getAllItems: () => cy.getByTestId('list-item-title'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-item'),
  getAddFirstWishlistItemLink: () => cy.getByTestId('add-first-wishlist-item'),
  getAddFirstSeriesTrackerItemLink: () => cy.getByTestId('add-first-series-tracker-item'),
  getAddFirstMovieTrackerItemLink: () => cy.getByTestId('add-first-movie-tracker-item'),
  setListPreferredRatingToUser: () =>
    cy.request('POST', '/api/v1/user/settings', {
      collectionListDisplayPreferences: {
        showYear: true,
        showSharedIcon: true,
        preferredRating: 'user',
        imdbRatingFallback: false,
      },
    }),

  // Float buttons
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getRandomPickButton: () => cy.getByTestId('random-pick'),
  getScrollToTopButton: () => cy.getByTestId('scroll-to-top'),
  getAiSearchToggleButton: () => cy.getByTestId('ai-search-toggle'),
  getOrderByToggleButton: () => cy.getByTestId('list-order-by-toggle'),
  getOrderDirectionToggleButton: () => cy.getByTestId('list-order-direction-toggle'),
  getCollectionFilterButton: (filter: string) => cy.getByTestId(`collection-filter-${filter}`),

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
  getNewItemCopyToSeriesTrackerAsWatchedCheckbox: () =>
    cy.getByTestId('new-item-copy-to-series-tracker-as-watched').find('input[type="checkbox"]'),
  getNewItemSaveButton: () => cy.getByTestId('new-item-save'),
  getNewItemSaveAndNewButton: () => cy.getByTestId('new-item-save-and-new'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),

  // Item dialog
  getItemDialogShellHost: () => cy.getByTestId('item-dialog'),
  getItemDialogHost: getItemDialog,
  getItemDialogComponentHost: () => getDialogComponentHost('item-dialog'),
  getActiveDialogHost: getActiveDialog,
  getActiveDialogFrame,
  getFocusedElement: () => cy.focused(),
  swipeActiveDialogFromLeftEdge: () => swipeActiveDialog(2, 90),
  swipeActiveDialogFromRightEdge: () =>
    cy.window().then((window) => swipeActiveDialog(window.innerWidth - 2, window.innerWidth - 90)),
  getItemDialogEditButton: () => getItemDialog().find('[data-test-id="item-dialog-edit"]'),
  getItemDialogReadOnlyButton: () => getItemDialog().find('[data-test-id="item-dialog-read-only"]'),
  getItemDialogSaveButton: () => getItemDialog().find('[data-test-id="item-dialog-save"]'),
  getItemDialogDeleteButton: () => getItemDialog().find('[data-test-id="item-dialog-delete"]'),
  closeDialogByOverlay: () => getActiveDialog().find('[data-test-id="dialog-overlay"]').click({ force: true }),
  closeActiveDialogByOverlay: () => getActiveDialog().find('[data-test-id="dialog-overlay"]').click({ force: true }),
  openItemDialogActionsMenu: () => {
    getActiveDialog().then((dialog) => {
      cy.wrap(dialog).find('[data-test-id="dialog-actions-menu-button"]').click();
      cy.wrap(dialog).find('[data-test-id="dialog-actions-menu"]').should('be.visible');
    });
  },
  getItemDialogMarkFavoriteButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-favorite"]'),
  getItemDialogRemoveFavoriteButton: () => getItemDialog().find('[data-test-id="item-dialog-remove-favorite"]'),
  getItemDialogMarkWatchedButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-watched"]'),
  getItemDialogMarkUnwatchedButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-unwatched"]'),
  getItemDialogMoveMovieTrackerButton: () => getItemDialog().find('[data-test-id="item-dialog-move-movie-tracker"]'),
  getItemDialogSharedLibraryBadge: () => getItemDialog().find('[data-test-id="item-dialog-shared-library"]'),
  getItemDialogUserRateChip: () => getItemDialog().find('[data-test-id="item-dialog-user-rate-chip"]'),
  getItemDialogTitleInput: () => getItemDialog().find('[data-test-id="item-dialog-title"] input'),
  getItemDialogYearInput: () => getItemDialog().find('[data-test-id="item-dialog-year"] input'),
  getItemDialogIMDbRateInput: () => getItemDialog().find('[data-test-id="item-dialog-rate"] input'),
  getItemDialogRottenTomatoesRateInput: () =>
    getItemDialog().find('[data-test-id="item-dialog-rotten-tomatoes-rate"] input'),
  getItemDialogMetacriticRateInput: () => getItemDialog().find('[data-test-id="item-dialog-metacritic-rate"] input'),
  getItemDialogUserRateInput: () => getItemDialog().find('[data-test-id="item-dialog-user-rate"] input'),
  getItemDialogEpisodeProgressChip: () => getItemDialog().find('[data-test-id="item-dialog-episode-progress-chip"]'),
  getItemDialogCompletedChip: () => getItemDialog().find('[data-test-id="item-dialog-completed-chip"]'),
  getItemDialogManageWatchedEpisodesButton: () =>
    getItemDialog().find('[data-test-id="item-dialog-manage-watched-episodes"]'),
  getItemDialogManageSeriesMetadataButton: () =>
    getItemDialog().find('[data-test-id="item-dialog-manage-series-metadata"]'),
  getItemDialogGenreInput: () => getItemDialog().find('[data-test-id="item-dialog-genre"] input'),
  getItemDialogTagsInput: () => getItemDialog().find('[data-test-id="item-dialog-tags"] input'),
  getItemDialogActorsInput: () => getItemDialog().find('[data-test-id="item-dialog-actors"] input'),
  getItemDialogPlotInput: () => getItemDialog().find('[data-test-id="item-dialog-plot"] textarea'),
  getItemDialogWatchedUpToSeasonSelect: () =>
    getItemDialog().find('[data-test-id="item-dialog-watched-up-to-season"] select'),
  getItemDialogWatchedUpToEpisodeSelect: () =>
    getItemDialog().find('[data-test-id="item-dialog-watched-up-to-episode"] select'),

  // Series metadata dialog
  getSeriesMetadataDialogHost: () => cy.getByTestId('series-metadata-dialog'),
  getSeriesMetadataDialog: getSeriesMetadataDialog,
  getSeriesMetadataDialogComponentHost: () => getDialogComponentHost('series-metadata-dialog'),
  getSeriesMetadataMessage: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-message"]'),
  getSeriesMetadataNoMetadataMessage: () =>
    getSeriesMetadataDialog().find('[data-test-id="series-metadata-no-metadata-message"]'),
  getSeriesMetadataAddButton: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-add"]'),
  getSeriesMetadataRefreshButton: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-refresh"]'),
  getSeriesMetadataRemoveAllButton: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-remove-all"]'),
  getSeriesMetadataSaveButton: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-save"]'),
  getSeriesMetadataValidation: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-validation"]'),
  getSeriesMetadataSeasonInputs: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-season"] input'),
  getSeriesMetadataEpisodeInputs: () =>
    getSeriesMetadataDialog().find('[data-test-id="series-metadata-episodes"] input'),
  getSeriesMetadataRemoveButtons: () => getSeriesMetadataDialog().find('[data-test-id="series-metadata-remove"]'),
  getSeriesMetadataEpisodeTitleToggles: () =>
    getSeriesMetadataDialog().find('[data-test-id="series-metadata-episode-titles-toggle"] summary'),
  getSeriesMetadataEpisodeTitleInputs: () =>
    getSeriesMetadataDialog().find('[data-test-id="series-metadata-episode-title"] input'),

  // Watched episodes dialog
  getWatchedEpisodesDialogHost,
  getWatchedEpisodesDialogComponentHost: () => getDialogComponentHost('watched-episodes-dialog'),
  getWatchedEpisodesDialog: () => getDialogFrame(getWatchedEpisodesDialog()),
  getWatchedEpisodesSeasonToggle: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-season-toggle"]'),
  getWatchedEpisodesEpisodeCheckbox: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-episode-checkbox"]'),
  getWatchedEpisodesMarkAllWatchedButton: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-mark-all-watched"]'),
  getWatchedEpisodesMarkAllUnwatchedButton: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-mark-all-unwatched"]'),
  getWatchedEpisodesNoMetadataMessage: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-no-metadata-message"]'),
  getWatchedEpisodesManageSeasonMetadataButton: () =>
    getWatchedEpisodesDialog().find('[data-test-id="watched-episodes-manage-season-metadata"]'),
};
