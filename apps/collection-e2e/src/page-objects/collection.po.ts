import { expect, type Locator, type Page } from '@playwright/test';
import type { ApiClient } from '../support/test';

export const createCollectionPage = (page: Page) => {
  const getActiveDialog = () => page.locator('.dialog').last();
  const getDialogFrame = (subject: Locator) => subject.locator('[data-test-id="dialog-frame"]');
  const getActiveDialogFrame = () => page.getByTestId('dialog-frame').last();
  const getItemDialog = () => getDialogFrame(page.getByTestId('item-dialog').last());
  const getSeriesMetadataDialog = () => getDialogFrame(page.getByTestId('series-metadata-dialog').last());
  const getCompletedEpisodesDialogHost = () => page.getByTestId('completed-episodes-dialog');
  const getCompletedEpisodesDialogFrame = () => getDialogFrame(getCompletedEpisodesDialogHost().last());
  const getDialogComponentHost = (testId: string) =>
    page
      .getByTestId(testId)
      .last()
      .locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " dialog ")][1]');
  const expandFloatSearch = async (testId: string) => {
    await expect(page.getByTestId(testId).or(page.getByTestId('float-search-toggle')).first()).toBeAttached();
    if ((await page.getByTestId(testId).count()) === 0) {
      await page.getByTestId('float-search-toggle').click();
    }
  };
  const getFloatSearchInput = async (testId: string) => {
    await expandFloatSearch(testId);
    return page.getByTestId(testId).locator('input');
  };
  const swipeActiveDialog = async (startX: number, endX: number) => {
    const activeDialogFrame = getActiveDialogFrame();
    await activeDialogFrame.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: startX,
      clientY: 180,
    });
    await activeDialogFrame.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: endX,
      clientY: 184,
    });
  };

  return {
    visit: async () => {
      await page.goto('/client/#/collection/library');
      await page.reload();
    },
    visitTracking: async () => {
      await page.goto('/client/#/collection/tracking');
    },
    visitUpNext: async () => {
      await page.goto('/client/#/collection/up-next');
    },
    visitWishlist: async () => {
      await page.goto('/client/#/collection/wishlist');
    },
    visitBooks: async () => {
      await page.goto('/client/#/collection/books');
    },
    visitLibraryWithSharedFilter: async (shared: 'mine' | 'shared') => {
      await page.goto(`/client/#/collection/library?shared=${shared}`);
      await page.reload();
    },
    visitLibraryWithQuery: async (query: string) => {
      await page.goto(`/client/#/collection/library?${query}`);
      await page.reload();
    },
    visitTrackingWithQuery: async (query: string) => {
      await page.goto(`/client/#/collection/tracking?${query}`);
      await page.reload();
    },
    visitBooksWithQuery: async (query: string) => {
      await page.goto(`/client/#/collection/books?${query}`);
      await page.reload();
    },
    getMediaChip: (chip: 'all' | 'movie' | 'series' | 'book' | 'album') =>
      page.getByTestId(`collection-media-chip-${chip}`),

    // Search
    getSearchInput: () => getFloatSearchInput('collection-search'),
    getSearchHost: () => page.getByTestId('collection-search'),
    getTrackingSearchInput: () => getFloatSearchInput('tracking-search'),
    getUpNextSearchInput: () => getFloatSearchInput('up-next-search'),
    getWishlistSearchInput: () => getFloatSearchInput('wishlist-search'),

    // List
    getList: () => page.getByTestId('collection-list'),
    getListItems: () => page.getByTestId('list-item-title'),
    getListItemByTitle: (title: string) =>
      page.getByTestId('list-item-title').and(page.getByRole('heading', { name: title, exact: true })),
    getFavoriteBadges: () => page.getByTestId('list-item-favorite'),
    getTrackingCompletedBadges: () => page.getByTestId('list-item-tracking-completed'),
    getSharedBadges: () => page.getByTestId('list-item-shared'),
    getListItemYears: () => page.getByTestId('list-item-year'),
    getListItemImdbRatings: () => page.getByTestId('list-item-rating-imdb'),
    getListItemRottenTomatoesRatings: () => page.getByTestId('list-item-rating-rotten-tomatoes'),
    getListItemMetacriticRatings: () => page.getByTestId('list-item-rating-metacritic'),
    getListItemUserRates: () => page.getByTestId('list-item-user-rate'),
    getListItemImages: () => page.getByTestId('list-item-image'),
    getListItemImageBadges: () => page.getByTestId('list-item-image-badge'),
    getListItemImageByTitle: (title: string) =>
      page.getByTestId('list-item-image').and(page.getByLabel(title, { exact: true })),
    getAllItems: () => page.getByTestId('list-item-title'),
    getEmptyState: () => page.getByTestId('list-empty'),
    getAddFirstItemLink: () => page.getByTestId('add-first-item'),
    getAddFirstUpNextItemLink: () => page.getByTestId('add-first-up-next-item'),
    getAddFirstWishlistItemLink: () => page.getByTestId('add-first-wishlist-item'),
    getAddFirstTrackingItemLink: () => page.getByTestId('add-first-tracking-item'),
    setListPreferredRatingToUser: async (api: ApiClient) => {
      await api.request('POST', '/api/v1/users/me/settings', {
        collectionListDisplayPreferences: {
          showYear: true,
          showSharedIcon: true,
          preferredRating: 'user',
          imdbRatingFallback: false,
        },
      });
    },

    // Float buttons
    getShowFunctionsButton: () => page.getByTestId('show-functions'),
    getAddNewButton: () => page.getByTestId('add-new'),
    getRandomPickButton: () => page.getByTestId('random-pick'),
    getScrollToTopButton: () => page.getByTestId('scroll-to-top'),
    getFloatSearchToggleButton: () => page.getByTestId('float-search-toggle'),
    getAiSearchButton: () => page.getByTestId('float-ai-search-button'),
    getOrderByCreatedAtButton: () => page.getByTestId('list-order-by-created-at'),
    getOrderByAlphabetButton: () => page.getByTestId('list-order-by-alphabet'),
    getOrderDirectionDescButton: () => page.getByTestId('list-order-direction-desc'),
    getOrderDirectionAscButton: () => page.getByTestId('list-order-direction-asc'),
    getCollectionFilterButton: (filter: string) => page.getByTestId(`collection-filter-${filter}`),

    // AI search input
    openAiSearchDialog: async () => {
      await page.getByTestId('float-ai-search-button').click();
    },
    getAiSearchTextarea: () => page.getByTestId('ai-search-textarea').locator('textarea'),
    getAiSearchSendButton: () => page.getByTestId('ai-search-send'),

    // New item dialog
    getNewItemSearch: () => page.getByTestId('new-item-search'),
    getNewItemSearchInput: () => page.getByTestId('new-item-search').locator('input'),
    getNewItemSearchModeButton: () => page.getByTestId('new-item-search-mode'),
    getNewItemManualModeButton: () => page.getByTestId('new-item-manual-mode'),
    getNewItemModeTabs: () => page.getByTestId('new-item-mode-tabs'),
    getNewItemSearchPanel: () => page.getByTestId('new-item-mode-first-panel'),
    getNewItemManualPanel: () => page.getByTestId('new-item-mode-second-panel'),
    getNewItemManualHint: () => page.getByTestId('new-item-manual-hint'),
    getNewItemManualHintAndPreview: () =>
      getActiveDialogFrame().locator(
        '[data-test-id="new-item-manual-hint"], [data-test-id="new-item-manual-image-preview"]'
      ),
    getNewItemLibrarySelect: () => page.getByTestId('new-item-library').locator('select'),
    getNewItemContentSelect: () => page.getByTestId('new-item-search-content-type').locator('select'),
    getNewItemContentOptions: () => page.getByTestId('new-item-content-option'),
    getNewItemUserRateInput: () => page.getByTestId('new-item-user-rate').locator('input'),
    getNewItemCopyToTrackingAsCompletedCheckbox: () =>
      page.getByTestId('new-item-copy-to-tracking-as-completed').locator('input[type="checkbox"]'),
    getNewItemSaveButton: () => page.getByTestId('new-item-save'),
    getNewItemSaveAndNewButton: () => page.getByTestId('new-item-save-and-new'),
    getNewItemSaveAndCloseButton: () => page.getByTestId('new-item-save-and-close'),
    getNewItemActionButtons: () =>
      getActiveDialogFrame().locator(
        '[data-test-id="new-item-save"], [data-test-id="new-item-save-and-new"], [data-test-id="new-item-save-and-close"]'
      ),

    // Manual new item form
    getNewItemManualTitleInput: () => page.getByTestId('new-item-manual-title').locator('input'),
    getNewItemManualImdbIdInput: () => page.getByTestId('new-item-manual-imdb-id').locator('input'),
    getNewItemManualYearInput: () => page.getByTestId('new-item-manual-year').locator('input'),
    getNewItemManualContentTypeSelect: () => page.getByTestId('new-item-manual-content-type').locator('select'),
    getNewItemManualRateInput: () => page.getByTestId('new-item-manual-rate').locator('input'),
    getNewItemManualRottenTomatoesRateInput: () =>
      page.getByTestId('new-item-manual-rotten-tomatoes-rate').locator('input'),
    getNewItemManualMetacriticRateInput: () => page.getByTestId('new-item-manual-metacritic-rate').locator('input'),
    getNewItemManualUserRateInput: () => page.getByTestId('new-item-manual-user-rate').locator('input'),
    getNewItemManualImageInput: () => page.getByTestId('new-item-manual-image').locator('input'),
    getNewItemManualImagePreview: () => page.getByTestId('new-item-manual-image-preview'),
    getNewItemManualGenreInput: () => page.getByTestId('new-item-manual-genre').locator('input'),
    getNewItemManualTagsInput: () => page.getByTestId('new-item-manual-tags').locator('input'),
    getNewItemManualActorsInput: () => page.getByTestId('new-item-manual-actors').locator('input'),
    getNewItemManualPlotInput: () => page.getByTestId('new-item-manual-plot').locator('textarea'),
    getNewItemManualProgressCurrentInput: () => page.getByTestId('new-item-manual-progress-current').locator('input'),
    getNewItemManualProgressTotalInput: () => page.getByTestId('new-item-manual-progress-total').locator('input'),
    getNewItemProgressCurrentInput: () => page.getByTestId('new-item-progress-current').locator('input'),
    getNewItemProgressTotalInput: () => page.getByTestId('new-item-progress-total').locator('input'),
    getListItemProgress: () => page.getByTestId('list-item-progress'),

    // Item dialog
    getItemDialogShellHost: () => page.getByTestId('item-dialog'),
    getItemDialogHost: getItemDialog,
    getItemDialogComponentHost: () => getDialogComponentHost('item-dialog'),
    getActiveDialogHost: getActiveDialog,
    getActiveDialogFrame,
    getFocusedElement: () => page.locator(':focus'),
    swipeActiveDialogFromLeftEdge: async () => {
      await swipeActiveDialog(2, 90);
    },
    swipeActiveDialogFromRightEdge: async () => {
      const viewport = page.viewportSize();
      if (!viewport) throw new Error('Page viewport is unavailable');
      await swipeActiveDialog(viewport.width - 2, viewport.width - 90);
    },
    getItemDialogEditButton: () => getItemDialog().locator('[data-test-id="item-dialog-edit"]'),
    getItemDialogReadOnlyButton: () => getItemDialog().locator('[data-test-id="item-dialog-read-only"]'),
    getItemDialogSaveButton: () => getItemDialog().locator('[data-test-id="item-dialog-save"]'),
    getItemDialogSaveLabel: () => getItemDialog().locator('[data-test-id="item-dialog-save-label"]'),
    getItemDialogDeleteButton: () => getItemDialog().locator('[data-test-id="item-dialog-delete"]'),
    getItemDialogShareButton: () => getItemDialog().locator('[data-test-id="item-dialog-share"]'),
    closeDialogByOverlay: async () => {
      await getActiveDialog()
        .locator('[data-test-id="dialog-overlay"]')
        .click({ position: { x: 10, y: 10 } });
    },
    closeActiveDialogByOverlay: async () => {
      await getActiveDialog()
        .locator('[data-test-id="dialog-overlay"]')
        .click({ position: { x: 10, y: 10 } });
    },
    expectItemDialogActionsVisible: async () => {
      await expect(getActiveDialog().locator('[data-test-id="dialog-actions-menu"]')).toBeVisible();
    },
    getDialogActionTooltip: () => getActiveDialog().locator('[data-test-id="reveal-label-tooltip"]'),
    getItemDialogActionButtons: () => getItemDialog().locator('.button-reveal-label'),
    holdItemDialogAction: async (testId: string) => {
      await getItemDialog().locator(`[data-test-id="${testId}"]`).dispatchEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 100,
        clientY: 100,
      });
      await expect(getActiveDialog().locator('[data-test-id="reveal-label-tooltip"]')).toBeVisible();
    },
    releaseHeldItemDialogAction: async (testId: string) => {
      await getItemDialog()
        .locator(`[data-test-id="${testId}"]`)
        .evaluate((element) => {
          const elementWindow = element.ownerDocument.defaultView;
          if (!elementWindow) throw new Error('Dialog action window is unavailable');
          element.dispatchEvent(
            new elementWindow.PointerEvent('pointerup', {
              bubbles: true,
              pointerId: 1,
              pointerType: 'touch',
              isPrimary: true,
              clientX: 100,
              clientY: 100,
            })
          );
          (element as HTMLElement).click();
        });
    },
    getItemDialogMarkFavoriteButton: () => getItemDialog().locator('[data-test-id="item-dialog-mark-favorite"]'),
    getItemDialogRemoveFavoriteButton: () => getItemDialog().locator('[data-test-id="item-dialog-remove-favorite"]'),
    getItemDialogMarkFinishedButton: () => getItemDialog().locator('[data-test-id="item-dialog-mark-finished"]'),
    getItemDialogMarkUnfinishedButton: () => getItemDialog().locator('[data-test-id="item-dialog-mark-unfinished"]'),
    getItemDialogMoveFinishedButton: () => getItemDialog().locator('[data-test-id="item-dialog-move-finished"]'),
    getItemDialogMoveTrackingButton: () => getItemDialog().locator('[data-test-id="item-dialog-move-tracking"]'),
    getItemDialogCopyTrackingButton: () => getItemDialog().locator('[data-test-id="item-dialog-copy-tracking"]'),
    getItemDialogOpenInTrackingButton: () => getItemDialog().locator('[data-test-id="item-dialog-open-in-tracking"]'),
    getItemDialogRemoveTrackingButton: () => getItemDialog().locator('[data-test-id="item-dialog-remove-tracking"]'),
    getItemDialogSharedLibraryBadge: () => getItemDialog().locator('[data-test-id="item-dialog-shared-library"]'),
    getItemDialogUserRateChip: () => getItemDialog().locator('[data-test-id="item-dialog-user-rate-chip"]'),
    getItemDialogTitleInput: () => getItemDialog().locator('[data-test-id="item-dialog-title"] input'),
    getItemDialogYearInput: () => getItemDialog().locator('[data-test-id="item-dialog-year"] input'),
    getItemDialogIMDbRateInput: () => getItemDialog().locator('[data-test-id="item-dialog-rate"] input'),
    getItemDialogRottenTomatoesRateInput: () =>
      getItemDialog().locator('[data-test-id="item-dialog-rotten-tomatoes-rate"] input'),
    getItemDialogMetacriticRateInput: () =>
      getItemDialog().locator('[data-test-id="item-dialog-metacritic-rate"] input'),
    getItemDialogUserRateInput: () => getItemDialog().locator('[data-test-id="item-dialog-user-rate"] input'),
    getItemDialogEpisodeProgressChip: () =>
      getItemDialog().locator('[data-test-id="item-dialog-episode-progress-chip"]'),
    getItemDialogProgressChip: () => getItemDialog().locator('[data-test-id="item-dialog-progress-chip"]'),
    getItemDialogProgressCurrentInput: () =>
      getItemDialog().locator('[data-test-id="item-dialog-progress-current"] input'),
    getItemDialogProgressTotalInput: () => getItemDialog().locator('[data-test-id="item-dialog-progress-total"] input'),
    getItemDialogCompletedChip: () => getItemDialog().locator('[data-test-id="item-dialog-completed-chip"]'),
    getItemDialogManageCompletedEpisodesButton: () =>
      getItemDialog().locator('[data-test-id="item-dialog-manage-completed-episodes"]'),
    getItemDialogManageSeriesMetadataButton: () =>
      getItemDialog().locator('[data-test-id="item-dialog-manage-series-metadata"]'),
    getItemDialogGenreInput: () => getItemDialog().locator('[data-test-id="item-dialog-genre"] input'),
    getItemDialogTagsInput: () => getItemDialog().locator('[data-test-id="item-dialog-tags"] input'),
    getItemDialogTagSuggestions: () => getItemDialog().locator('[data-test-id="item-dialog-tags"] [role="option"]'),
    getItemDialogActorsInput: () => getItemDialog().locator('[data-test-id="item-dialog-actors"] input'),
    getItemDialogPlotInput: () => getItemDialog().locator('[data-test-id="item-dialog-plot"] textarea'),
    getItemDialogWatchedUpToSeasonSelect: () =>
      getItemDialog().locator('[data-test-id="item-dialog-watched-up-to-season"] select'),
    getItemDialogWatchedUpToEpisodeSelect: () =>
      getItemDialog().locator('[data-test-id="item-dialog-watched-up-to-episode"] select'),

    // Series metadata dialog
    getSeriesMetadataDialogHost: () => page.getByTestId('series-metadata-dialog'),
    getSeriesMetadataDialog,
    getSeriesMetadataDialogComponentHost: () => getDialogComponentHost('series-metadata-dialog'),
    getSeriesMetadataMessage: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-message"]'),
    getSeriesMetadataNoMetadataMessage: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-no-metadata-message"]'),
    getSeriesMetadataAddButton: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-add"]'),
    getSeriesMetadataRefreshButton: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-refresh"]'),
    getSeriesMetadataRemoveAllButton: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-remove-all"]'),
    getSeriesMetadataSaveButton: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-save"]'),
    getSeriesMetadataValidation: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-validation"]'),
    getSeriesMetadataSeasonInputs: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-season"] input'),
    getSeriesMetadataEpisodeInputs: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-episodes"] input'),
    getSeriesMetadataRemoveButtons: () => getSeriesMetadataDialog().locator('[data-test-id="series-metadata-remove"]'),
    getSeriesMetadataEpisodeTitleToggles: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-episode-titles-toggle"] summary'),
    getSeriesMetadataEpisodeTitleInputs: () =>
      getSeriesMetadataDialog().locator('[data-test-id="series-metadata-episode-title"] input'),

    // Completed episodes dialog
    getCompletedEpisodesDialogHost,
    getCompletedEpisodesDialogComponentHost: () => getDialogComponentHost('completed-episodes-dialog'),
    getCompletedEpisodesDialog: getCompletedEpisodesDialogFrame,
    getCompletedEpisodesSeasonSummaries: () => getCompletedEpisodesDialogFrame().locator('details > summary'),
    getCompletedEpisodesSeasonToggle: () =>
      getCompletedEpisodesDialogFrame()
        .locator('[data-test-id="completed-episodes-season-toggle"]')
        .locator('input[type="checkbox"]'),
    getCompletedEpisodesEpisodeCheckbox: () =>
      getCompletedEpisodesDialogFrame()
        .locator('[data-test-id="completed-episodes-episode-checkbox"]')
        .locator('input[type="checkbox"]'),
    getCompletedEpisodesMarkAllCompletedButton: () =>
      getCompletedEpisodesDialogFrame().locator('[data-test-id="completed-episodes-mark-all-completed"]'),
    getCompletedEpisodesMarkAllUncompletedButton: () =>
      getCompletedEpisodesDialogFrame().locator('[data-test-id="completed-episodes-mark-all-uncompleted"]'),
    getCompletedEpisodesNoMetadataMessage: () =>
      getCompletedEpisodesDialogFrame().locator('[data-test-id="completed-episodes-no-metadata-message"]'),
    getCompletedEpisodesManageSeasonMetadataButton: () =>
      getCompletedEpisodesDialogFrame().locator('[data-test-id="completed-episodes-manage-season-metadata"]'),
  };
};
