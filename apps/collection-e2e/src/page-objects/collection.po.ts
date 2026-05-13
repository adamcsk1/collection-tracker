export const CollectionPage = {
  visit: () => {
    cy.visit('/client/#/collection');
    cy.reload();
  },

  // Search
  getSearchInput: () => cy.getByTestId('collection-search').find('input'),

  // List
  getList: () => cy.getByTestId('collection-list'),
  getListItems: () => cy.getByTestId('list-item-title'),
  getSharedBadges: () => cy.getByTestId('list-item-shared'),
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getAllItems: () => cy.getByTestId('list-item-title'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-item'),

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
  getNewItemSaveButton: () => cy.getByTestId('new-item-save'),
  getNewItemSaveAndNewButton: () => cy.getByTestId('new-item-save-and-new'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),

  // Item dialog
  getItemDialogEditButton: () => cy.getByTestId('item-dialog-edit'),
  getItemDialogSaveButton: () => cy.getByTestId('item-dialog-save'),
  getItemDialogDeleteButton: () => cy.getByTestId('item-dialog-delete'),
  getItemDialogMarkWatchedButton: () => cy.getByTestId('item-dialog-mark-watched'),
  getItemDialogMarkUnwatchedButton: () => cy.getByTestId('item-dialog-mark-unwatched'),
  getItemDialogSharedLibraryBadge: () => cy.getByTestId('item-dialog-shared-library'),
  getItemDialogTitleInput: () => cy.getByTestId('item-dialog-title'),
  getItemDialogYearInput: () => cy.getByTestId('item-dialog-year'),
  getItemDialogGenreInput: () => cy.getByTestId('item-dialog-genre').find('input'),
  getItemDialogTagsInput: () => cy.getByTestId('item-dialog-tags').find('input'),
  getItemDialogActorsInput: () => cy.getByTestId('item-dialog-actors'),
  getItemDialogPlotInput: () => cy.getByTestId('item-dialog-plot'),
};
