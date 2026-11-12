import type { Page } from '@playwright/test';

export const createExportImportPage = (page: Page) => ({
  visit: async () => {
    await page.goto('/client/#/settings/export-import');
    await page.reload();
  },

  getCollectionDataExportButton: () => page.getByTestId('collection-data-export'),
  getCollectionDataImportButton: () => page.getByTestId('collection-data-import'),
  getCollectionDataImportFileInput: () => page.getByTestId('collection-data-import-file'),
  getCollectionItemsImdbIdImportButton: () => page.getByTestId('collection-items-imdb-id-import'),
  getCollectionItemsImdbIdImportFileInput: () => page.getByTestId('collection-items-imdb-id-import-file'),
  getTagManagementExportButton: () => page.getByTestId('tag-management-export'),
  getTagManagementImportButton: () => page.getByTestId('tag-management-import'),
  getTagManagementImportFileInput: () => page.getByTestId('tag-management-import-file'),
  getToastMessage: () => page.getByTestId('toast-message'),
});
