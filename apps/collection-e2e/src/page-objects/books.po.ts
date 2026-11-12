import type { Page } from '@playwright/test';

export const createBooksPage = (page: Page) => {
  const getItemDialog = () => page.getByTestId('item-dialog').last().locator('[data-test-id="dialog-frame"]');

  return {
    visit: async () => {
      await page.goto('/client/#/collection/books');
    },
    getSearchInput: () => page.getByTestId('books-search').locator('input'),
    getEmptyState: () => page.getByTestId('list-empty'),
    getAddFirstItemLink: () => page.getByTestId('add-first-books-item'),
    getShowFunctionsButton: () => page.getByTestId('show-functions'),
    getAddNewButton: () => page.getByTestId('add-new'),
    getNewItemSearchInput: () => page.getByTestId('new-item-search').locator('input'),
    getNewItemContentOptions: () => page.getByTestId('new-item-content-option'),
    getNewItemSaveAndCloseButton: () => page.getByTestId('new-item-save-and-close'),
    getNewItemManualModeButton: () => page.getByTestId('new-item-manual-mode'),
    getNewItemManualTitleInput: () => page.getByTestId('new-item-manual-title').locator('input'),
    getNewItemManualIsbnInput: () => page.getByTestId('new-item-manual-imdb-id').locator('input'),
    getNewItemManualAuthorsInput: () => page.getByTestId('new-item-manual-actors').locator('input'),
    getListItemTitles: () => page.getByTestId('list-item-title'),
    getListItemImages: () => page.getByTestId('list-item-image'),
    getItemDialog,
    getItemDialogIsbn: () => getItemDialog().locator('[data-test-id="item-dialog-isbn"]'),
    getItemDialogDeleteButton: () => getItemDialog().locator('[data-test-id="item-dialog-delete"]'),
  };
};
