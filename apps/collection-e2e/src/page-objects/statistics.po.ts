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
  getSummaryWatchedMovies: () => cy.getByTestId('statistics-summary-watched-movies'),
  getSummaryWatchedSeries: () => cy.getByTestId('statistics-summary-watched-series'),
  getSummaryUnwatchedMovies: () => cy.getByTestId('statistics-summary-unwatched-movies'),
  getSummaryUnwatchedLibrarySeries: () => cy.getByTestId('statistics-summary-unwatched-library-series'),
  getSummaryUnwatchedTrackerSeries: () => cy.getByTestId('statistics-summary-unwatched-tracker-series'),
  getSummaryCompletedTrackerSeries: () => cy.getByTestId('statistics-summary-completed-tracker-series'),
  openTagsDetails: () => {
    cy.getByTestId('statistics-tags-details')
      .find('details')
      .then(($details) => {
        if (!$details.prop('open')) cy.wrap($details).find('summary').click();
      });
  },
  getTagButton: (tag: string) => cy.getByTestId(`statistics-tag-${tag}`).scrollIntoView(),
  clickAvailableTagButton: (tag: string) =>
    cy
      .getByTestId('statistics-tags')
      .find(`[data-test-id="statistics-tag-${tag}"]`)
      .scrollIntoView()
      .then(($button) => {
        ($button[0] as HTMLButtonElement).click();
      }),
  getSelectedTagButton: (tag: string) =>
    cy.getByTestId('statistics-selected-tags').find(`[data-test-id="statistics-tag-${tag}"]`).scrollIntoView(),
  clickSelectedTagButton: (tag: string) =>
    cy
      .getByTestId('statistics-selected-tags')
      .find(`[data-test-id="statistics-tag-${tag}"]`)
      .scrollIntoView()
      .then(($button) => {
        ($button[0] as HTMLButtonElement).click();
      }),
  getTagsEmpty: () => cy.getByTestId('statistics-tags-empty').scrollIntoView(),
  getTagChartCard: () => cy.getByTestId('statistics-tag-chart-card'),
};
