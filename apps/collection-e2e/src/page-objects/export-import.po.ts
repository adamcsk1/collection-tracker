export const ExportImportPage = {
  visit: () => {
    cy.visit('/client/#/settings/export-import');
    cy.reload();
  },

  getCollectionDataExportButton: () => cy.getByTestId('collection-data-export'),
  getCollectionDataImportButton: () => cy.getByTestId('collection-data-import'),
  getTagManagementExportButton: () => cy.getByTestId('tag-management-export'),
  getTagManagementImportButton: () => cy.getByTestId('tag-management-import'),
  getTagManagementImportFileInput: () => cy.getByTestId('tag-management-import-file'),
};
