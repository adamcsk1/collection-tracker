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
  selectScope: async (scope: StatisticsScope) => {
    await page.getByTestId(`collection-media-chip-${scope}`).click();
  },
  getScopeChip: (scope: StatisticsScope) => page.getByTestId(`collection-media-chip-${scope}`),
  openTagsDetails: async () => {
    const details = page.getByTestId('statistics-tags-details').locator('details');
    const isOpen = await details.evaluate((element) => (element as HTMLDetailsElement).open);
    if (!isOpen) await details.locator('summary').click();
  },
  getTag: (tag: string) => page.getByTestId(`statistics-tag-${tag}`),
  getUnavailableTagsMessage: async () => {
    const message = page.getByTestId('statistics-tags-unavailable');
    await message.scrollIntoViewIfNeeded();
    return message;
  },
  getTagChartCard: () => page.getByTestId('statistics-tag-chart-card'),
  getOverviewChartCard: () => page.getByTestId('statistics-overview-chart-card'),
  getRatingChartCard: () => page.getByTestId('statistics-rating-chart-card'),
});
