import { TestBed } from '@angular/core/testing';
import { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsChartService } from './statistics-chart-service';

const chartConstructorMock = vi.hoisted(() =>
  vi.fn(function ChartMock(this: Record<string, unknown>, canvas: HTMLCanvasElement, config: unknown) {
    this.canvas = canvas;
    this.config = config;
    this.data = { labels: [], datasets: [] };
    this.update = vi.fn();
  })
);

vi.mock('chart.js/auto', () => ({ default: chartConstructorMock }));

describe('StatisticsChartService', () => {
  let service: StatisticsChartService;

  const emptyCommonCharts = {
    tagCounts: [],
    genreCounts: [],
    releaseYearCounts: [],
    userRatingCounts: [],
  };

  beforeEach(() => {
    chartConstructorMock.mockClear();
    document.body.replaceChildren();
    TestBed.configureTestingModule({
      providers: [
        StatisticsChartService,
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    service = TestBed.inject(StatisticsChartService);
  });

  it('creates each chart with responsive options and a horizontal genre axis', () => {
    document.body.innerHTML = `
      <canvas id="statistics-tag-chart"></canvas>
      <canvas id="statistics-overview-chart"></canvas>
      <canvas id="statistics-genre-chart"></canvas>
      <canvas id="statistics-release-year-chart"></canvas>
      <canvas id="statistics-rating-chart"></canvas>
    `;

    expect(service.createTagChart(null)).not.toBeNull();
    expect(service.createOverviewChart(null)).not.toBeNull();
    expect(service.createGenreChart(null)).not.toBeNull();
    expect(service.createReleaseYearChart(null)).not.toBeNull();
    expect(service.createRatingChart(null)).not.toBeNull();

    expect(chartConstructorMock).toHaveBeenCalledTimes(5);
    expect(chartConstructorMock).toHaveBeenNthCalledWith(
      1,
      document.getElementById('statistics-tag-chart'),
      expect.objectContaining({
        type: 'pie',
        options: expect.objectContaining({ responsive: true, maintainAspectRatio: false }),
      })
    );
    expect(chartConstructorMock).toHaveBeenNthCalledWith(
      3,
      document.getElementById('statistics-genre-chart'),
      expect.objectContaining({
        type: 'bar',
        options: expect.objectContaining({ indexAxis: 'y', maintainAspectRatio: false }),
      })
    );
  });

  it('reuses existing charts and returns null when a canvas is missing', () => {
    const existingChart = buildChart<'pie'>();

    expect(service.createTagChart(existingChart)).toBe(existingChart);
    expect(service.createTagChart(null)).toBeNull();
    expect(chartConstructorMock).not.toHaveBeenCalled();
  });

  it('reuses overview and bar charts and returns null for missing canvases', () => {
    const overviewChart = buildChart<'doughnut'>();
    const barChart = buildChart<'bar'>();

    expect(service.createOverviewChart(overviewChart)).toBe(overviewChart);
    expect(service.createOverviewChart(null)).toBeNull();
    expect(service.createGenreChart(barChart)).toBe(barChart);
    expect(service.createGenreChart(null)).toBeNull();
  });

  it('updates the selected tag chart and includes missing selections as zero', () => {
    const chart = buildChart<'pie'>();

    service.updateTagChart(
      chart,
      [
        { tag: '#drama', count: 2 },
        { tag: '#action', count: 1 },
      ],
      ['#action', '#missing']
    );

    expect(chart.data.labels).toEqual(['#action', '#missing']);
    expect(chart.data.datasets[0].data).toEqual([1, 0]);
    expect(chart.update).toHaveBeenCalled();
  });

  it('adapts the overview dataset to media types for the all scope', () => {
    const chart = buildChart<'doughnut'>();
    const statistics: CollectionStatisticsApiResponseModel = {
      scope: 'all',
      summary: { total: 4, movies: 2, series: 1, books: 1, favorites: 0 },
      charts: {
        ...emptyCommonCharts,
        mediaTypeCounts: [
          { type: 'movie', count: 2 },
          { type: 'series', count: 1 },
          { type: 'book', count: 1 },
        ],
        statusCounts: [],
      },
    };

    service.updateOverviewChart(chart, statistics);

    expect(chart.data.labels).toEqual(['Movies', 'Series', 'Books']);
    expect(chart.data.datasets[0].data).toEqual([2, 1, 1]);
  });

  it.each([
    ['movie', ['Watched', 'Unwatched'], [2, 1]],
    ['series', ['Completed', 'InProgress'], [1, 1]],
    ['book', ['Read', 'Unread', 'InProgress'], [1, 2, 1]],
  ] as const)('adapts the overview dataset to %s statuses', (scope, labels, counts) => {
    const chart = buildChart<'doughnut'>();
    const statistics = buildScopedStatistics(scope);

    service.updateOverviewChart(chart, statistics);

    expect(chart.data.labels).toEqual(labels);
    expect(chart.data.datasets[0].data).toEqual(counts);
  });

  it('updates genre, release-year, and rating datasets', () => {
    const genreChart = buildChart<'bar'>();
    const releaseYearChart = buildChart<'bar'>();
    const ratingChart = buildChart<'bar'>();

    service.updateGenreChart(genreChart, [
      { genre: 'Low', count: 1 },
      { genre: 'High', count: 3 },
      { genre: 'Mid', count: 2 },
    ]);
    service.updateReleaseYearChart(releaseYearChart, [
      { year: '2025', count: 2 },
      { year: '2026', count: 1 },
    ]);
    service.updateRatingChart(ratingChart, [
      { rating: 7, count: 1 },
      { rating: 8.5, count: 2 },
    ]);

    expect(genreChart.data.labels).toEqual(['High', 'Mid', 'Low']);
    expect(genreChart.data.datasets[0].data).toEqual([3, 2, 1]);
    expect(releaseYearChart.data.labels).toEqual(['2025', '2026']);
    expect(releaseYearChart.data.datasets[0].data).toEqual([2, 1]);
    expect(ratingChart.data.labels).toEqual(['7', '8.5']);
    expect(ratingChart.data.datasets[0].data).toEqual([1, 2]);
  });

  it('ignores chart updates when chart or statistics are missing', () => {
    const overviewChart = buildChart<'doughnut'>();

    service.updateTagChart(null, [], []);
    service.updateOverviewChart(null, null);
    service.updateOverviewChart(overviewChart, null);
    service.updateGenreChart(null, []);
    service.updateReleaseYearChart(null, []);
    service.updateRatingChart(null, []);

    expect(overviewChart.update).not.toHaveBeenCalled();
  });

  const buildChart = <TType extends 'pie' | 'doughnut' | 'bar'>() =>
    ({
      data: { labels: [], datasets: [] },
      update: vi.fn(),
    }) as unknown as Chart<TType, number[], string>;

  const buildScopedStatistics = (scope: 'movie' | 'series' | 'book'): CollectionStatisticsApiResponseModel => {
    if (scope === 'movie') {
      return {
        scope,
        summary: { total: 3, favorites: 0, watched: 2, unwatched: 1 },
        charts: {
          ...emptyCommonCharts,
          mediaTypeCounts: [],
          statusCounts: [
            { status: 'watched', count: 2 },
            { status: 'unwatched', count: 1 },
          ],
        },
      };
    }
    if (scope === 'series') {
      return {
        scope,
        summary: { total: 2, favorites: 0, tracked: 2, untracked: 0, completed: 1, inProgress: 1 },
        charts: {
          ...emptyCommonCharts,
          mediaTypeCounts: [],
          statusCounts: [
            { status: 'completed', count: 1 },
            { status: 'inProgress', count: 1 },
          ],
        },
      };
    }
    return {
      scope,
      summary: { total: 4, favorites: 0, read: 1, unread: 2, inProgress: 1 },
      charts: {
        ...emptyCommonCharts,
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'read', count: 1 },
          { status: 'unread', count: 2 },
          { status: 'inProgress', count: 1 },
        ],
      },
    };
  };
});
