export const CollectionPage = {
  visit: () => cy.visit('/client/#/collection'),

  // Search
  getSearchInput: () => cy.getByTestId('collection-search').find('input'),

  // List
  getList: () => cy.getByTestId('collection-list'),
  getListItems: () => cy.getByTestId('list-item-title'),
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getAllItems: () => cy.getByTestId('collection-list').find('[role="listitem"]:not([aria-hidden="true"])'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-item'),

  // Float buttons
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getRandomPickButton: () => cy.getByTestId('random-pick'),
  getScrollToTopButton: () => cy.getByTestId('scroll-to-top'),

  openFloatButtons: () => {
    cy.getByTestId('show-functions').then(($btn) => {
      if ($btn.is(':visible')) {
        $btn.trigger('click');
      }
    });
  },

  // New item dialog
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemContentSelect: () => cy.getByTestId('new-item-content-select').find('select'),
  getNewItemSaveButton: () => cy.getByTestId('new-item-save'),

  // Item dialog
  getItemDialogEditButton: () => cy.getByTestId('item-dialog-edit'),
  getItemDialogSaveButton: () => cy.getByTestId('item-dialog-save'),
  getItemDialogDeleteButton: () => cy.getByTestId('item-dialog-delete'),
  getItemDialogMarkWatchedButton: () => cy.getByTestId('item-dialog-mark-watched'),
  getItemDialogMarkUnwatchedButton: () => cy.getByTestId('item-dialog-mark-unwatched'),

  // Nav
  getNavMenuButton: () => cy.getByTestId('nav-menu-button'),
};
