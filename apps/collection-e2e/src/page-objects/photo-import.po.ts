import type { Locator, Page } from '@playwright/test';

export const createPhotoImportDialog = (page: Page) => {
  const getDialogHost = () => page.getByTestId('photo-import-dialog');
  const getRows = () => getDialogHost().getByTestId('photo-import-row');
  const getRow = (index: number) => getRows().nth(index);
  const getSearchInput = (index: number) => getRow(index).getByTestId('photo-import-search').locator('input');
  const getMatchButtons = (index: number) => getRow(index).getByTestId('photo-import-option');
  const getFromPhotosButton = () => page.getByTestId('new-item-from-photos');
  const getDialog = () => page.getByTestId('dialog-frame').filter({ has: getDialogHost() });
  const getReadButton = () => getDialog().getByTestId('photo-import-read');
  const getAddButton = () => getDialog().getByTestId('photo-import-add');

  return {
    getFromPhotosButton,
    getAvailabilityStatus: () => getDialogHost().getByTestId('photo-import-unavailable'),
    getDialogHost,
    getComponentHost: () => page.getByTestId('photo-import-component'),
    getDialog,
    getContentTypeSelect: () => getDialog().getByTestId('photo-import-content-type').locator('select'),
    getLibrarySelect: () => getDialog().getByTestId('photo-import-library').locator('select'),
    getContext: () => getDialogHost().getByTestId('photo-import-context'),
    getPrivacy: () => getDialogHost().getByTestId('photo-import-privacy'),
    getPhotos: () => getDialogHost().getByTestId('photo-import-photo'),
    getProgress: () => getDialogHost().getByTestId('photo-import-progress'),
    getRows,
    getRow,
    getStatus: (index: number) => getRow(index).getByTestId('photo-import-row-status'),
    getSearchInput,
    getMatchButtons,
    getReadButton,
    getChooseButton: () => getDialog().getByTestId('photo-import-choose'),
    getAddButton,
    getFooter: () => getDialog().getByTestId('photo-import-footer'),
    open: async () => {
      await getFromPhotosButton().click();
    },
    uploadPhotos: async (files: Parameters<Locator['setInputFiles']>[0]) => {
      await getDialogHost().getByTestId('photo-import-files').setInputFiles(files);
    },
    readPhotos: async () => {
      await getReadButton().click();
    },
    selectMatch: async (rowIndex: number, matchIndex = 0) => {
      await getMatchButtons(rowIndex).nth(matchIndex).click();
    },
    searchRow: async (index: number, query: string) => {
      await getSearchInput(index).fill(query);
      await getRow(index).getByTestId('photo-import-search-button').click();
    },
    toggleSkip: async (index: number) => {
      await getRow(index).getByTestId('photo-import-skip').click();
    },
    addSelected: async () => {
      await getAddButton().click();
    },
    close: async () => {
      await page.keyboard.press('Escape');
    },
  };
};
