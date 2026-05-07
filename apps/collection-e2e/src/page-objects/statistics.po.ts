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
  getSummaryWatched: () => cy.getByTestId('statistics-summary-watched'),
  getSummaryUnwatched: () => cy.getByTestId('statistics-summary-unwatched'),
  getTagButton: (tag: string) => cy.getByTestId(`statistics-tag-${tag}`),
  getTagsEmpty: () => cy.getByTestId('statistics-tags-empty'),
  getChart: () => cy.get('#statistics-tag-chart'),
};
