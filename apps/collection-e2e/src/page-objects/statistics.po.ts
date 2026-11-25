import type { Page } from '@playwright/test';
import type { StatisticsScope } from './statistics-model';

export const createStatisticsPage = (page: Page) => ({
  visit: async () => {
    await page.goto('/client/#/statistics');
  },
  getContent: () => page.getByTestId('statistics-content'),
  getScrollContainer: () => page.getByTestId('statistics-scroll'),
  getEmptyMessage: () => page.getByTestId('statistics-empty'),
  getSummary: () => page.getByTestId('statistics-summary'),
  getSummaryCard: (card: string) => page.getByTestId(`statistics-summary-${card}`),
  getSummaryCards: () => page.getByTestId('statistics-summary').getByRole('button'),
  collectionView: () => page.getByTestId('statistics-collection-view'),
  yearView: () => page.getByTestId('statistics-year-view'),
  yearInput: () => page.getByTestId('statistics-year').locator('input'),
  thisYear: () => page.getByTestId('statistics-this-year'),
  lastYear: () => page.getByTestId('statistics-last-year'),
  activityCard: (status: 'planned' | 'completed' | 'inProgress') => page.getByTestId(`statistics-activity-${status}`),
  month: (month: number) => page.getByTestId('statistics-months').getByTestId(`statistics-bar-${month}`),
  openMonths: async () => {
    await page.getByTestId('statistics-monthly-details').locator('summary').click();
  },
  allMonths: () => page.getByTestId('statistics-all-months'),
  items: () => page.getByTestId('statistics-item'),
  loadMore: () => page.getByTestId('statistics-load-more'),
  selectScope: async (scope: StatisticsScope) => {
    await page.getByTestId(`collection-media-chip-${scope}`).click();
  },
  getScopeChip: (scope: StatisticsScope) => page.getByTestId(`collection-media-chip-${scope}`),
  getTag: (tag: string) => page.getByTestId('statistics-tag-chart-card').getByTestId(`statistics-bar-${tag}`),
  getTagChartCard: () => page.getByTestId('statistics-tag-chart-card'),
  getOverviewChartCard: () => page.getByTestId('statistics-overview-chart-card'),
  getRatingChartCard: () => page.getByTestId('statistics-rating-chart-card'),
});
