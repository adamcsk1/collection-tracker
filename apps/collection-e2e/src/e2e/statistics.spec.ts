import { buildCollectionItem } from '../fixtures/collection-item';
import { buildBooksItem } from '../fixtures/openlibrary';
import { createStatisticsPage } from '../page-objects/statistics.po';
import { expect, test } from '../support/test';

let statisticsPage: ReturnType<typeof createStatisticsPage>;

test.beforeEach(async ({ page }) => {
  statisticsPage = createStatisticsPage(page);
});

test.describe('Statistics — empty collection', () => {
  test('shows the empty state', async ({ autoLogin }) => {
    await autoLogin();
    await statisticsPage.visit();

    await expect(statisticsPage.getEmptyMessage()).toBeVisible();
  });
});

test.describe('Statistics — scoped collection', () => {
  test.beforeEach(async ({ api, autoLogin, page }) => {
    await autoLogin();
    await page.evaluate(() => window.localStorage.removeItem('CT.StatisticsSelectedTags'));
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Movie One', 'movie', 'tt9000001'),
      tags: ['#movie-only', '#shared'],
      favorite: true,
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Movie Two', 'movie', 'tt9000002'),
      tags: ['#movie-only'],
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildCollectionItem('Statistics Series', 'series', 'tt9000003'),
      tags: ['#series-only'],
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book In Progress', '9780306406157'),
      tags: ['#book-only', '#shared'],
      favorite: true,
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book Unread', '9780140328721'),
      tags: ['#book-only'],
    });
    await api.request('POST', '/api/v1/collection-items', {
      ...buildBooksItem('Statistics Book In Progress', '9780306406157'),
      listType: 'tracking',
      progressCurrent: 50,
      progressTotal: 100,
    });
    await statisticsPage.visit();
    await expect(statisticsPage.getSummary()).toBeVisible();
  });

  test('shows only limited summary cards and combined tags in all mode', async () => {
    await expect(statisticsPage.getScopeChip('all')).toHaveAttribute('aria-pressed', 'true');
    await expect(statisticsPage.getSummaryCard('all')).toContainText('5');
    await expect(statisticsPage.getSummaryCard('movies')).toContainText('2');
    await expect(statisticsPage.getSummaryCard('series')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('books')).toContainText('2');
    await expect(statisticsPage.getSummaryCard('favorites')).toContainText('2');
    await expect(statisticsPage.getSummaryCard('watched-movies')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('tracked-series')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('read-books')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('wishlist')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('up-next')).toHaveCount(0);
    await statisticsPage.openTagsDetails();
    await statisticsPage.getTag('#movie-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#movie-only')).toBeVisible();
    await statisticsPage.getTag('#series-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#series-only')).toBeVisible();
    await statisticsPage.getTag('#book-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#book-only')).toBeVisible();
    await statisticsPage.getOverviewChartCard().scrollIntoViewIfNeeded();
    await expect(statisticsPage.getOverviewChartCard()).toBeVisible();
    await expect(statisticsPage.getTagChartCard()).toHaveClass(/chart-hidden/);
    await expect(statisticsPage.getTagChartCard()).toHaveCSS('position', 'absolute');
    await expect(statisticsPage.getRatingChartCard()).toHaveClass(/chart-hidden/);
    await expect(statisticsPage.getRatingChartCard()).toHaveCSS('position', 'absolute');
  });

  test('keeps the media type chooser visible while statistics content scrolls', async () => {
    const scrollContainer = statisticsPage.getScrollContainer();
    const scrollMetrics = await scrollContainer.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    await scrollContainer.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));

    await expect(statisticsPage.getScopeChip('all')).toBeVisible();
    await expect.poll(() => scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('shows movie-focused cards and movie tags in movie mode', async () => {
    await statisticsPage.selectScope('movie');

    await expect(statisticsPage.getScopeChip('movie')).toHaveAttribute('aria-pressed', 'true');
    await expect(statisticsPage.getSummaryCard('movies')).toContainText('2');
    await expect(statisticsPage.getSummaryCard('favorites')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('watched-movies')).toHaveCount(1);
    await expect(statisticsPage.getSummaryCard('unwatched-movies')).toHaveCount(1);
    await expect(statisticsPage.getSummaryCard('all')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('series')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('books')).toHaveCount(0);
    await statisticsPage.openTagsDetails();
    await statisticsPage.getTag('#movie-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#movie-only')).toBeVisible();
    await expect(statisticsPage.getTag('#series-only')).toHaveCount(0);
    await expect(statisticsPage.getTag('#book-only')).toHaveCount(0);
    await expect(statisticsPage.getRatingChartCard()).toHaveCount(1);
  });

  test('shows series-focused cards and navigates tracked series to tracking', async ({ page }) => {
    await statisticsPage.selectScope('series');

    await expect(statisticsPage.getScopeChip('series')).toHaveAttribute('aria-pressed', 'true');
    await expect(statisticsPage.getSummaryCard('series')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('favorites')).toContainText('0');
    await expect(statisticsPage.getSummaryCard('tracked-series')).toHaveCount(1);
    await expect(statisticsPage.getSummaryCard('untracked-series')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('completed-series')).toHaveCount(1);
    await expect(statisticsPage.getSummaryCard('in-progress-series')).toHaveCount(1);
    await statisticsPage.openTagsDetails();
    await statisticsPage.getTag('#series-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#series-only')).toBeVisible();
    await expect(statisticsPage.getTag('#movie-only')).toHaveCount(0);

    await statisticsPage.getSummaryCard('tracked-series').click();
    await expect(page).toHaveURL(/#\/collection\/tracking/);
    await expect(page).toHaveURL(/type=series/);
  });

  test('shows book-specific cards and only book tags in book mode', async ({ page }) => {
    await statisticsPage.selectScope('book');

    await expect(statisticsPage.getScopeChip('book')).toHaveAttribute('aria-pressed', 'true');
    await expect(statisticsPage.getSummaryCard('books')).toContainText('2');
    await expect(statisticsPage.getSummaryCard('favorites')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('read-books')).toContainText('0');
    await expect(statisticsPage.getSummaryCard('unread-books')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('in-progress-books')).toContainText('1');
    await expect(statisticsPage.getSummaryCard('movies')).toHaveCount(0);
    await expect(statisticsPage.getSummaryCard('series')).toHaveCount(0);
    await statisticsPage.openTagsDetails();
    await statisticsPage.getTag('#book-only').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#book-only')).toBeVisible();
    await statisticsPage.getTag('#shared').scrollIntoViewIfNeeded();
    await expect(statisticsPage.getTag('#shared')).toBeVisible();
    await expect(statisticsPage.getTag('#movie-only')).toHaveCount(0);
    await expect(statisticsPage.getTag('#series-only')).toHaveCount(0);

    await statisticsPage.getSummaryCard('books').click();
    await expect(page).toHaveURL(/#\/collection\/books/);
  });
});
