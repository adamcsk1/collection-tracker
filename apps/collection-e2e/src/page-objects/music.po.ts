const getItemDialog = () => cy.getByTestId('item-dialog').last().find('[data-test-id="dialog-frame"]');

export const MusicPage = {
  visit: () => {
    cy.visit('/client/#/collection/music');
  },
  getSearchInput: () => cy.getByTestId('music-search').find('input'),
  getEmptyState: () => cy.getByTestId('list-empty'),
  getAddFirstItemLink: () => cy.getByTestId('add-first-music-item'),
  getShowFunctionsButton: () => cy.getByTestId('show-functions'),
  getAddNewButton: () => cy.getByTestId('add-new'),
  getNewItemSearchInput: () => cy.getByTestId('new-item-search').find('input'),
  getNewItemContentOptions: () => cy.getByTestId('new-item-content-option'),
  getNewItemSaveAndCloseButton: () => cy.getByTestId('new-item-save-and-close'),
  getNewItemManualModeButton: () => cy.getByTestId('new-item-manual-mode'),
  getNewItemManualTitleInput: () => cy.getByTestId('new-item-manual-title').find('input'),
  getNewItemManualMbidInput: () => cy.getByTestId('new-item-manual-imdb-id').find('input'),
  getNewItemManualArtistsInput: () => cy.getByTestId('new-item-manual-actors').find('input'),
  getListItemTitles: () => cy.getByTestId('list-item-title'),
  getListItemImages: () => cy.getByTestId('list-item-image'),
  getItemDialog: getItemDialog,
  getItemDialogMbid: () => getItemDialog().find('[data-test-id="item-dialog-mbid"]'),
  getItemDialogDeleteButton: () => getItemDialog().find('[data-test-id="item-dialog-delete"]'),
};
