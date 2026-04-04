export const StatisticsPage = {
  visit: () => {
    cy.visit('/client/#/statistics');
    cy.reload();
  },

  getEmptyMessage: () => cy.getByTestId('statistics-empty'),
  getSummary: () => cy.getByTestId('statistics-summary'),
  getSummaryAll: () => cy.getByTestId('statistics-summary-all'),
  getSummaryMovies: () => cy.getByTestId('statistics-summary-movies'),
  getSummarySeries: () => cy.getByTestId('statistics-summary-series'),
  getTagsContainer: () => cy.getByTestId('statistics-tags'),
  getTagButton: (tag: string) => cy.getByTestId(`statistics-tag-${tag}`),
  getTagsEmpty: () => cy.getByTestId('statistics-tags-empty'),
  getChart: () => cy.getByTestId('statistics-chart'),
};
