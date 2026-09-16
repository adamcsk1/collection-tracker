export const ExportImportPage = {
  visit: () => {
    cy.visit('/client/#/settings/export-import');
    cy.reload();
  },

  getCollectionDataExportButton: () => cy.getByTestId('collection-data-export'),
  getCollectionDataImportButton: () => cy.getByTestId('collection-data-import'),
  getCollectionDataImportFileInput: () => cy.getByTestId('collection-data-import-file'),
  getCollectionItemsImdbIdImportButton: () => cy.getByTestId('collection-items-imdb-id-import'),
  getCollectionItemsImdbIdImportFileInput: () => cy.getByTestId('collection-items-imdb-id-import-file'),
  getTagManagementExportButton: () => cy.getByTestId('tag-management-export'),
  getTagManagementImportButton: () => cy.getByTestId('tag-management-import'),
  getTagManagementImportFileInput: () => cy.getByTestId('tag-management-import-file'),
  getToastMessage: () => cy.getByTestId('toast-message'),
};
