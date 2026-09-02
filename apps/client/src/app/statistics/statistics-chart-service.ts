import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { CollectionStatisticsApiResponseModel, CollectionStatisticsStatus } from '@shared/models/api-model';
import { textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable()
export class StatisticsChartService {
  private readonly document = inject(DOCUMENT);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);

  public createTagChart(chart: Chart<'pie', number[], string> | null): Chart<'pie', number[], string> | null {
    if (chart) return chart;
    const canvas = this.getCanvas('statistics-tag-chart');
    if (!canvas) return null;
    return new Chart(canvas, {
      type: 'pie',
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  public createOverviewChart(
    chart: Chart<'doughnut', number[], string> | null
  ): Chart<'doughnut', number[], string> | null {
    if (chart) return chart;
    const canvas = this.getCanvas('statistics-overview-chart');
    if (!canvas) return null;
    return new Chart(canvas, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%' },
    });
  }

  public createGenreChart(chart: Chart<'bar', number[], string> | null): Chart<'bar', number[], string> | null {
    return this.createBarChart(chart, 'statistics-genre-chart', true);
  }

  public createReleaseYearChart(chart: Chart<'bar', number[], string> | null): Chart<'bar', number[], string> | null {
    return this.createBarChart(chart, 'statistics-release-year-chart');
  }

  public createRatingChart(chart: Chart<'bar', number[], string> | null): Chart<'bar', number[], string> | null {
    return this.createBarChart(chart, 'statistics-rating-chart');
  }

  public updateTagChart(
    chart: Chart<'pie', number[], string> | null,
    tagCounts: Array<{ tag: string; count: number }>,
    selectedTags: string[]
  ): void {
    if (!chart) return;
    const countByTag = new Map(tagCounts.map(({ tag, count }) => [tag, count]));
    chart.data.labels = selectedTags;
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: selectedTags.map((tag) => countByTag.get(tag) ?? 0),
        backgroundColor: selectedTags.map((tag) => textToHexColor(tag.replace('#', ''))),
      },
    ];
    chart.update();
  }

  public updateOverviewChart(
    chart: Chart<'doughnut', number[], string> | null,
    statistics: CollectionStatisticsApiResponseModel | null
  ): void {
    if (!chart || !statistics) return;
    const entries =
      statistics.scope === 'all'
        ? statistics.charts.mediaTypeCounts.map(({ type, count }) => ({ key: type, count }))
        : statistics.charts.statusCounts.map(({ status, count }) => ({ key: status, count }));
    chart.data.labels = entries.map(({ key }) => this.translateOverviewLabel(key));
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: entries.map(({ count }) => count),
        backgroundColor: entries.map(({ key }) => textToHexColor(key)),
      },
    ];
    chart.update();
  }

  public updateGenreChart(
    chart: Chart<'bar', number[], string> | null,
    genreCounts: Array<{ genre: string; count: number }>
  ): void {
    if (!chart) return;
    const entries = [...genreCounts].sort((a, b) => b.count - a.count).slice(0, 10);
    chart.data.labels = entries.map(({ genre }) => genre);
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: entries.map(({ count }) => count),
        backgroundColor: entries.map(({ genre }) => textToHexColor(genre)),
      },
    ];
    chart.update();
  }

  public updateReleaseYearChart(
    chart: Chart<'bar', number[], string> | null,
    releaseYearCounts: Array<{ year: string; count: number }>
  ): void {
    if (!chart) return;
    chart.data.labels = releaseYearCounts.map(({ year }) => year);
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: releaseYearCounts.map(({ count }) => count),
        backgroundColor: textToHexColor('releaseYear'),
      },
    ];
    chart.update();
  }

  public updateRatingChart(
    chart: Chart<'bar', number[], string> | null,
    userRatingCounts: Array<{ rating: number; count: number }>
  ): void {
    if (!chart) return;
    chart.data.labels = userRatingCounts.map(({ rating }) => `${rating}`);
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: userRatingCounts.map(({ count }) => count),
        backgroundColor: textToHexColor('userRating'),
      },
    ];
    chart.update();
  }

  private createBarChart(
    chart: Chart<'bar', number[], string> | null,
    elementId: string,
    horizontal = false
  ): Chart<'bar', number[], string> | null {
    if (chart) return chart;
    const canvas = this.getCanvas(elementId);
    if (!canvas) return null;
    return new Chart(canvas, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { precision: 0 } }, y: { ticks: { precision: 0 } } },
      },
    });
  }

  private getCanvas(elementId: string): HTMLCanvasElement | null {
    return this.document.getElementById(elementId) as HTMLCanvasElement | null;
  }

  private translateOverviewLabel(key: CollectionStatisticsStatus | 'movie' | 'series' | 'book' | 'album'): string {
    const translationKeys: Record<typeof key, string> = {
      movie: 'Movies',
      series: 'Series',
      book: 'Books',
      album: 'Music',
      watched: 'Watched',
      unwatched: 'Unwatched',
      untracked: 'Untracked',
      completed: 'Completed',
      inProgress: 'InProgress',
      read: 'Read',
      unread: 'Unread',
      listened: 'Listened',
      unlistened: 'Unlistened',
    };
    return this.ngxSignalTranslate.translate(translationKeys[key]);
  }
}
