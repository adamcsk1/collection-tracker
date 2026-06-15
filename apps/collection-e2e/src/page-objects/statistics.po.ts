import { CommonPage } from './common.po';

export const StatisticsPage = {
  visit: () => {
    cy.visit('/client/#/collection/library');
    CommonPage.openMenu();
    CommonPage.getNavStatisticsLink().click();
  },

  getEmptyMessage: () => cy.getByTestId('statistics-empty', { timeout: 10000 }),
  getSummary: () => cy.getByTestId('statistics-summary', { timeout: 10000 }),
  getSummaryAll: () => cy.getByTestId('statistics-summary-all', { timeout: 10000 }),
  getSummaryMovies: () => cy.getByTestId('statistics-summary-movies'),
  getSummarySeries: () => cy.getByTestId('statistics-summary-series'),
  getSummaryFavorites: () => cy.getByTestId('statistics-summary-favorites'),
  getSummaryWatchLater: () => cy.getByTestId('statistics-summary-watch-later'),
  getSummaryWishlist: () => cy.getByTestId('statistics-summary-wishlist'),
  getSummaryWatched: () => cy.getByTestId('statistics-summary-watched'),
  getSummaryUnwatched: () => cy.getByTestId('statistics-summary-unwatched'),
  getTagButton: (tag: string) => cy.getByTestId(`statistics-tag-${tag}`),
  getTagsEmpty: () => cy.getByTestId('statistics-tags-empty'),
  getChart: () => cy.get('#statistics-tag-chart'),
};
