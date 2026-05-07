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
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getAllItems: () => cy.getByTestId('list-item-title'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-item'),

  // Float buttons
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getRandomPickButton: () => cy.getByTestId('random-pick'),
  getScrollToTopButton: () => cy.getByTestId('scroll-to-top'),
  getClaudeAiToggleButton: () => cy.getByTestId('claude-ai-toggle'),

  // Claude AI search input
  getClaudeAiTrigger: () => cy.getByTestId('claude-ai-trigger'),
  getClaudeAiTextarea: () => cy.getByTestId('claude-ai-textarea').find('textarea'),
  getClaudeAiSendButton: () => cy.getByTestId('claude-ai-send'),

  // New item dialog
  getNewItemSearch: () => cy.get('[data-test-id="new-item-search"]'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
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
};
