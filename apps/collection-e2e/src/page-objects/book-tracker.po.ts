const getItemDialog = () => cy.getByTestId('item-dialog').last().find('[data-test-id="dialog-frame"]');

export const BookTrackerPage = {
  visit: () => {
    cy.visit('/client/#/collection/book-tracker');
  },
  getSearchInput: () => cy.getByTestId('book-tracker-search').find('input'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-book-tracker-item'),
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemContentOptions: () => cy.getByTestId('new-item-content-option'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),
  getListItemTitles: () => cy.getByTestId('list-item-title'),
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getItemDialog: getItemDialog,
  getItemDialogIsbn: () => getItemDialog().find('[data-test-id="item-dialog-isbn"]'),
  getItemDialogDeleteButton: () => getItemDialog().find('[data-test-id="item-dialog-delete"]'),
};
