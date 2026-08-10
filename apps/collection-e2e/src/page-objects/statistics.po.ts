type StatisticsScope = 'all' | 'movie' | 'series' | 'book';

export const StatisticsPage = {
  visit: () => {
    cy.visit('/client/#/statistics');
  },
  getContent: () => cy.getByTestId('statistics-content', { timeout: 10000 }),
  getScrollContainer: () => cy.getByTestId('statistics-scroll', { timeout: 10000 }),
  getEmptyMessage: () => cy.getByTestId('statistics-empty', { timeout: 10000 }),
  getSummary: () => cy.getByTestId('statistics-summary', { timeout: 10000 }),
  getSummaryCard: (card: string) => cy.getByTestId(`statistics-summary-${card}`, { timeout: 10000 }),
  selectScope: (scope: StatisticsScope) => cy.getByTestId(`collection-media-chip-${scope}`).click(),
  getScopeChip: (scope: StatisticsScope) => cy.getByTestId(`collection-media-chip-${scope}`),
  openTagsDetails: () => {
    cy.getByTestId('statistics-tags-details')
      .find('details')
      .then(($details) => {
        if (!$details.prop('open')) cy.wrap($details).find('summary').click();
      });
  },
  getTag: (tag: string) => cy.getByTestId(`statistics-tag-${tag}`),
  getUnavailableTagsMessage: () => cy.getByTestId('statistics-tags-unavailable').scrollIntoView(),
  getTagChartCard: () => cy.getByTestId('statistics-tag-chart-card'),
  getOverviewChartCard: () => cy.getByTestId('statistics-overview-chart-card'),
  getRatingChartCard: () => cy.getByTestId('statistics-rating-chart-card'),
};
