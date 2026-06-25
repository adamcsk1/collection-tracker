import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import { textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';

@Injectable()
export class StatisticsChartService {
  private readonly document = inject(DOCUMENT);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);

  public createTagChart(chart: Chart<'pie', number[], string> | null): Chart<'pie', number[], string> | null {
    if (chart) return chart;
    const canvas = this.document.getElementById('statistics-tag-chart') as HTMLCanvasElement | null;
    if (!canvas) return null;

    return new Chart(canvas, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  public createWatchedChart(
    chart: Chart<'doughnut', number[], string> | null
  ): Chart<'doughnut', number[], string> | null {
    return this.createDoughnutChart(chart, 'statistics-watched-chart');
  }

  public createTypeChart(
    chart: Chart<'doughnut', number[], string> | null
  ): Chart<'doughnut', number[], string> | null {
    return this.createDoughnutChart(chart, 'statistics-type-chart');
  }

  public createGenreChart(chart: Chart<'bar', number[], string> | null): Chart<'bar', number[], string> | null {
    if (chart) return chart;
    const canvas = this.document.getElementById('statistics-genre-chart') as HTMLCanvasElement | null;
    if (!canvas) return null;

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  public updateTagChart(
    chart: Chart<'pie', number[], string> | null,
    statistics: CollectionStatisticsApiResponseModel | null,
    selectedTags: string[]
  ): void {
    const tagCounts = statistics?.tagCounts ?? [];
    if (!chart) return;

    chart.data.labels = selectedTags;
    const data: number[] = [];

    for (const tag of selectedTags) {
      const count = tagCounts.find((tagCount) => tagCount.tag === tag)?.count ?? 0;
      data.push(count);
    }

    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data,
        backgroundColor: selectedTags.map((tag) => textToHexColor(tag.replace('#', ''))),
      },
    ];
    chart.update();
  }

  public updateWatchedChart(
    chart: Chart<'doughnut', number[], string> | null,
    statistics: CollectionStatisticsApiResponseModel | null
  ): void {
    if (!chart || !statistics) return;

    chart.data.labels = [
      this.ngxSignalTranslate.translate('WatchedMovies'),
      this.ngxSignalTranslate.translate('UnwatchedMovies'),
      this.ngxSignalTranslate.translate('CompletedSeries'),
      this.ngxSignalTranslate.translate('InProgressSeries'),
      this.ngxSignalTranslate.translate('UnwatchedLibrarySeries'),
    ];
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: [
          statistics.watchedMovieCount,
          statistics.unwatchedMovieCount,
          Math.max(0, statistics.watchedSeriesCount - statistics.unwatchedTrackerSeriesCount),
          statistics.unwatchedTrackerSeriesCount,
          statistics.unwatchedLibrarySeriesCount,
        ],
        backgroundColor: [
          textToHexColor('watchedMovies'),
          textToHexColor('unwatchedMovies'),
          textToHexColor('completedSeries'),
          textToHexColor('inProgressSeries'),
          textToHexColor('unwatchedLibrarySeries'),
        ],
      },
    ];
    chart.update();
  }

  public updateTypeChart(
    chart: Chart<'doughnut', number[], string> | null,
    statistics: CollectionStatisticsApiResponseModel | null
  ): void {
    if (!chart || !statistics) return;

    chart.data.labels = [this.ngxSignalTranslate.translate('Movies'), this.ngxSignalTranslate.translate('Series')];
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: [statistics.movieCount, statistics.seriesCount],
        backgroundColor: [textToHexColor('movie'), textToHexColor('series')],
      },
    ];
    chart.update();
  }

  public updateGenreChart(
    chart: Chart<'bar', number[], string> | null,
    statistics: CollectionStatisticsApiResponseModel | null
  ): void {
    const genreCounts = statistics?.genreCounts ?? [];
    if (!chart) return;

    const sortedGenres = [...genreCounts].sort((a, b) => b.count - a.count).slice(0, 10);

    chart.data.labels = sortedGenres.map((genreCount) => genreCount.genre);
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: sortedGenres.map((genreCount) => genreCount.count),
        backgroundColor: sortedGenres.map((genreCount) => textToHexColor(genreCount.genre)),
      },
    ];
    chart.update();
  }

  private createDoughnutChart(
    chart: Chart<'doughnut', number[], string> | null,
    elementId: string
  ): Chart<'doughnut', number[], string> | null {
    if (chart) return chart;
    const canvas = this.document.getElementById(elementId) as HTMLCanvasElement | null;
    if (!canvas) return null;

    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
      },
    });
  }
}
