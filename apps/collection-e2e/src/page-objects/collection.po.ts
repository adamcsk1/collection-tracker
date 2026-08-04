const getActiveDialog = () => cy.get('.dialog').last();
const getDialogFrame = (subject: Cypress.Chainable<JQuery<HTMLElement>>) =>
  subject.find('[data-test-id="dialog-frame"]');
const getActiveDialogFrame = () => cy.getByTestId('dialog-frame').last();
const getItemDialog = () => getDialogFrame(cy.getByTestId('item-dialog').last());
const getSeriesMetadataDialog = () => getDialogFrame(cy.getByTestId('series-metadata-dialog').last());
const getWatchedEpisodesDialogHost = () => cy.getByTestId('watched-episodes-dialog');
const getWatchedEpisodesDialog = () => getWatchedEpisodesDialogHost().last();
const getDialogComponentHost = (testId: string) => cy.getByTestId(testId).last().parents('.dialog').first();
const dialogActionHoldDuration = 500;
const expandFloatSearch = (testId: string) => {
  cy.get('body')
    .should((body) => {
      const targetSearch = body.find(`[data-test-id="${testId}"]`);
      const searchToggle = body.find('[data-test-id="float-search-toggle"]');
      expect(targetSearch.length + searchToggle.length).to.be.greaterThan(0);
    })
    .then((body) => {
      const targetSearch = body.find(`[data-test-id="${testId}"]`);
      if (!targetSearch.length) {
        cy.getByTestId('float-search-toggle').click();
      }
    });
};
const getFloatSearchInput = (testId: string) => {
  expandFloatSearch(testId);
  return cy.getByTestId(testId).find('input');
};
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

  visitWatching: () => {
    cy.visit('/client/#/collection/watching');
  },
  visitWatched: () => {
    cy.visit('/client/#/collection/watched');
  },
  visitWatchlist: () => {
    cy.visit('/client/#/collection/watchlist');
  },

  // Search
  getSearchInput: () => getFloatSearchInput('collection-search'),
  getSearchHost: () => cy.getByTestId('collection-search'),
  getWatchingSearchInput: () => getFloatSearchInput('watching-search'),
  getWatchedSearchInput: () => getFloatSearchInput('watched-search'),
  getWatchlistSearchInput: () => getFloatSearchInput('watchlist-search'),
  getWishlistSearchInput: () => getFloatSearchInput('wishlist-search'),

  // List
  getList: () => cy.getByTestId('collection-list'),
  getListItems: (options: Partial<Cypress.Timeoutable> = { timeout: 10000 }) =>
    cy.getByTestId('list-item-title', options),
  getFavoriteBadges: () => cy.getByTestId('list-item-favorite'),
  getWatchingCompletedBadges: () => cy.getByTestId('list-item-watching-completed'),
  getWatchedWatchedBadges: () => cy.getByTestId('list-item-watched'),
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
  getAddFirstWatchlistItemLink: () => cy.getByTestId('add-first-watchlist-item'),
  getAddFirstWishlistItemLink: () => cy.getByTestId('add-first-wishlist-item'),
  getAddFirstWatchingItemLink: () => cy.getByTestId('add-first-watching-item'),
  getAddFirstWatchedItemLink: () => cy.getByTestId('add-first-watched-item'),
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
  getFloatSearchToggleButton: () => cy.getByTestId('float-search-toggle'),
  getAiSearchButton: () => cy.getByTestId('float-ai-search-button'),
  getOrderByCreatedAtButton: () => cy.getByTestId('list-order-by-created-at'),
  getOrderByAlphabetButton: () => cy.getByTestId('list-order-by-alphabet'),
  getOrderDirectionDescButton: () => cy.getByTestId('list-order-direction-desc'),
  getOrderDirectionAscButton: () => cy.getByTestId('list-order-direction-asc'),
  getCollectionFilterButton: (filter: string) => cy.getByTestId(`collection-filter-${filter}`),

  // AI search input
  openAiSearchDialog: () => cy.getByTestId('float-ai-search-button').click(),
  getAiSearchTextarea: () => cy.getByTestId('ai-search-textarea').find('textarea'),
  getAiSearchSendButton: () => cy.getByTestId('ai-search-send'),

  // New item dialog
  getNewItemSearch: () => cy.get('[data-test-id="new-item-search"]'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemSearchModeButton: () => cy.getByTestId('new-item-search-mode'),
  getNewItemManualModeButton: () => cy.getByTestId('new-item-manual-mode'),
  getNewItemModeTabs: () => cy.getByTestId('new-item-mode-tabs'),
  getNewItemSearchPanel: () => cy.getByTestId('new-item-mode-first-panel'),
  getNewItemManualPanel: () => cy.getByTestId('new-item-mode-second-panel'),
  getNewItemManualHint: () => cy.getByTestId('new-item-manual-hint'),
  getNewItemManualHintAndPreview: () =>
    getActiveDialogFrame().find(
      '[data-test-id="new-item-manual-hint"], [data-test-id="new-item-manual-image-preview"]'
    ),
  getNewItemLibrarySelect: () => cy.getByTestId('new-item-library').find('select'),
  getNewItemContentSelect: () => cy.getByTestId('new-item-content-select'),
  getNewItemContentOptions: () => cy.getByTestId('new-item-content-option'),
  getNewItemUserRateInput: () => cy.getByTestId('new-item-user-rate').find('input'),
  getNewItemCopyToWatchingAsWatchedCheckbox: () =>
    cy.getByTestId('new-item-copy-to-watching-as-watched').find('input[type="checkbox"]'),
  getNewItemSaveButton: () => cy.getByTestId('new-item-save'),
  getNewItemSaveAndNewButton: () => cy.getByTestId('new-item-save-and-new'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),
  getNewItemActionButtons: () =>
    getActiveDialogFrame().find(
      '[data-test-id="new-item-save"], [data-test-id="new-item-save-and-new"], [data-test-id="new-item-save-and-close"]'
    ),

  // Manual new item form
  getNewItemManualTitleInput: () => cy.getByTestId('new-item-manual-title').find('input'),
  getNewItemManualImdbIdInput: () => cy.getByTestId('new-item-manual-imdb-id').find('input'),
  getNewItemManualYearInput: () => cy.getByTestId('new-item-manual-year').find('input'),
  getNewItemManualContentTypeSelect: () => cy.getByTestId('new-item-manual-content-type').find('select'),
  getNewItemManualRateInput: () => cy.getByTestId('new-item-manual-rate').find('input'),
  getNewItemManualRottenTomatoesRateInput: () => cy.getByTestId('new-item-manual-rotten-tomatoes-rate').find('input'),
  getNewItemManualMetacriticRateInput: () => cy.getByTestId('new-item-manual-metacritic-rate').find('input'),
  getNewItemManualUserRateInput: () => cy.getByTestId('new-item-manual-user-rate').find('input'),
  getNewItemManualImageInput: () => cy.getByTestId('new-item-manual-image').find('input'),
  getNewItemManualImagePreview: () => cy.getByTestId('new-item-manual-image-preview'),
  getNewItemManualGenreInput: () => cy.getByTestId('new-item-manual-genre').find('input'),
  getNewItemManualTagsInput: () => cy.getByTestId('new-item-manual-tags').find('input'),
  getNewItemManualActorsInput: () => cy.getByTestId('new-item-manual-actors').find('input'),
  getNewItemManualPlotInput: () => cy.getByTestId('new-item-manual-plot').find('textarea'),

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
  getItemDialogSaveLabel: () => getItemDialog().find('[data-test-id="item-dialog-save-label"]'),
  getItemDialogDeleteButton: () => getItemDialog().find('[data-test-id="item-dialog-delete"]'),
  closeDialogByOverlay: () => getActiveDialog().find('[data-test-id="dialog-overlay"]').click({ force: true }),
  closeActiveDialogByOverlay: () => getActiveDialog().find('[data-test-id="dialog-overlay"]').click({ force: true }),
  expectItemDialogActionsVisible: () => {
    getActiveDialog().then((dialog) => {
      cy.wrap(dialog).find('[data-test-id="dialog-actions-menu"]').should('be.visible');
    });
  },
  getDialogActionTooltip: () => getActiveDialog().find('[data-test-id="reveal-label-tooltip"]'),
  getItemDialogActionButtons: () => getItemDialog().find('.button-reveal-label'),
  holdItemDialogAction: (testId: string) => {
    getItemDialog().find(`[data-test-id="${testId}"]`).trigger('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 100,
      clientY: 100,
    });
    cy.wait(dialogActionHoldDuration);
  },
  releaseHeldItemDialogAction: (testId: string) => {
    getItemDialog()
      .find(`[data-test-id="${testId}"]`)
      .then((button) => {
        const element = button[0];
        const window = element.ownerDocument.defaultView;
        if (!window) throw new Error('Dialog action window is unavailable');
        element.dispatchEvent(
          new window.PointerEvent('pointerup', {
            bubbles: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 100,
            clientY: 100,
          })
        );
        element.click();
      });
  },
  getItemDialogMarkFavoriteButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-favorite"]'),
  getItemDialogRemoveFavoriteButton: () => getItemDialog().find('[data-test-id="item-dialog-remove-favorite"]'),
  getItemDialogMarkWatchedButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-watched"]'),
  getItemDialogMarkUnwatchedButton: () => getItemDialog().find('[data-test-id="item-dialog-mark-unwatched"]'),
  getItemDialogMoveWatchedButton: () => getItemDialog().find('[data-test-id="item-dialog-move-watched"]'),
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
  getItemDialogTagSuggestions: () => getItemDialog().find('[data-test-id="item-dialog-tags"] [role="option"]'),
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
