const getItemDialog = () => cy.getByTestId('item-dialog').last().find('[data-test-id="dialog-frame"]');

export const BooksPage = {
  visit: () => {
    cy.visit('/client/#/collection/books');
  },
  getSearchInput: () => cy.getByTestId('books-search').find('input'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-books-item'),
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemContentOptions: () => cy.getByTestId('new-item-content-option'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),
  getNewItemManualModeButton: () => cy.getByTestId('new-item-manual-mode'),
  getNewItemManualTitleInput: () => cy.getByTestId('new-item-manual-title').find('input'),
  getNewItemManualIsbnInput: () => cy.getByTestId('new-item-manual-imdb-id').find('input'),
  getNewItemManualAuthorsInput: () => cy.getByTestId('new-item-manual-actors').find('input'),
  getListItemTitles: () => cy.getByTestId('list-item-title'),
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getItemDialog: getItemDialog,
  getItemDialogIsbn: () => getItemDialog().find('[data-test-id="item-dialog-isbn"]'),
  getItemDialogDeleteButton: () => getItemDialog().find('[data-test-id="item-dialog-delete"]'),
};
