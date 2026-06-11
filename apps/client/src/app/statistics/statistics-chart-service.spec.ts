import { TestBed } from '@angular/core/testing';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsChartService } from './statistics-chart-service';

describe('StatisticsChartService', () => {
  let service: StatisticsChartService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StatisticsChartService,
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    service = TestBed.inject(StatisticsChartService);
  });

  it('updates the selected tag chart dataset', () => {
    const chart = buildChart<'pie'>();

    service.updateTagChart(
      chart,
      {
        totalItems: 2,
        movieCount: 1,
        seriesCount: 1,
        favoriteCount: 0,
        watchLaterCount: 0,
        wishlistCount: 0,
        watchedCount: 1,
        unwatchedCount: 1,
        tagCounts: [
          { tag: '#drama', count: 2 },
          { tag: '#action', count: 1 },
        ],
        genreCounts: [],
      },
      ['#action', '#missing']
    );

    expect(chart.data.labels).toEqual(['#action', '#missing']);
    expect(chart.data.datasets[0].data).toEqual([1, 0]);
    expect(chart.update).toHaveBeenCalled();
  });

  it('updates watched and type charts with translated labels', () => {
    const watchedChart = buildChart<'doughnut'>();
    const typeChart = buildChart<'doughnut'>();
    const statistics = {
      totalItems: 4,
      movieCount: 3,
      seriesCount: 1,
      favoriteCount: 0,
      watchLaterCount: 0,
      wishlistCount: 0,
      watchedCount: 2,
      unwatchedCount: 2,
      tagCounts: [],
      genreCounts: [],
    };

    service.updateWatchedChart(watchedChart, statistics);
    service.updateTypeChart(typeChart, statistics);

    expect(watchedChart.data.labels).toEqual(['Watched', 'Unwatched']);
    expect(watchedChart.data.datasets[0].data).toEqual([2, 2]);
    expect(typeChart.data.labels).toEqual(['Movies', 'Series']);
    expect(typeChart.data.datasets[0].data).toEqual([3, 1]);
  });

  it('updates the genre chart with the top ten genres by count', () => {
    const chart = buildChart<'bar'>();

    service.updateGenreChart(chart, {
      totalItems: 0,
      movieCount: 0,
      seriesCount: 0,
      favoriteCount: 0,
      watchLaterCount: 0,
      wishlistCount: 0,
      watchedCount: 0,
      unwatchedCount: 0,
      tagCounts: [],
      genreCounts: [
        { genre: 'Low', count: 1 },
        { genre: 'High', count: 3 },
        { genre: 'Mid', count: 2 },
      ],
    });

    expect(chart.data.labels).toEqual(['High', 'Mid', 'Low']);
    expect(chart.data.datasets[0].data).toEqual([3, 2, 1]);
  });

  const buildChart = <TType extends 'pie' | 'doughnut' | 'bar'>() =>
    ({
      data: { labels: [], datasets: [] },
      update: vi.fn(),
    }) as unknown as Chart<TType, number[], string>;
});
