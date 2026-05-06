import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StatisticsSummaryModel } from './statistics-model';
import { Details } from '@components/details/details';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import { textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';

@Component({
  selector: 'ct-statistics',
  imports: [NgxSignalTranslatePipe, Details],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  host: {
    class: 'page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly statistics = signal<CollectionStatisticsApiResponseModel | null>(null);
  protected readonly tags = computed(() => this.statistics()?.tagCounts.map((tagCount) => tagCount.tag) ?? []);
  protected readonly tagChart = signal<Chart<'pie', number[], string> | null>(null);
  protected readonly watchedChart = signal<Chart<'doughnut', number[], string> | null>(null);
  protected readonly typeChart = signal<Chart<'doughnut', number[], string> | null>(null);
  protected readonly genreChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly summary = computed<StatisticsSummaryModel>(() => {
    const statistics = this.statistics();
    return {
      movies: statistics?.movieCount ?? 0,
      series: statistics?.seriesCount ?? 0,
      all: statistics?.totalItems ?? 0,
      watched: statistics?.watchedCount ?? 0,
      unwatched: statistics?.unwatchedCount ?? 0,
    };
  });
  protected readonly defaultOpenSelectedTags: boolean;

  constructor() {
    const storedTags = this.webstorage.getItem(STORAGE_STATISTICS_SELECTED_TAGS);
    if (storedTags) this.selectedTags.set(JSON.parse(storedTags));
    this.defaultOpenSelectedTags = this.selectedTags().length === 0;
    this.loadStatistics();
  }

  public ngAfterViewInit(): void {
    this.createTagChart();
    this.createWatchedChart();
    this.createTypeChart();
    this.createGenreChart();

    if (this.selectedTags().length > 0) this.updateTagChart();
    this.updateWatchedChart();
    this.updateTypeChart();
    this.updateGenreChart();
  }

  public onToggleTag(tag: string): void {
    const currentTags = this.selectedTags();
    if (currentTags.includes(tag)) {
      this.selectedTags.update((selectedTags) => selectedTags.filter((selectedTag) => selectedTag !== tag));
    } else this.selectedTags.update((selectedTags) => [...selectedTags, tag]);

    this.webstorage.setItem(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(this.selectedTags()));
    this.updateTagChart();
  }

  protected readonly textToHexColor = textToHexColor;

  protected onNavigateToCollection(search?: string): void {
    if (search) {
      void this.router.navigate(['/collection'], { queryParams: { search } });
    } else {
      void this.router.navigate(['/collection']);
    }
  }

  private createTagChart(): void {
    if (this.tagChart()) return;
    const canvas = document.getElementById('statistics-tag-chart') as HTMLCanvasElement | null;
    if (!canvas) return;

    this.tagChart.set(
      new Chart(canvas, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
        },
      })
    );
  }

  private createWatchedChart(): void {
    if (this.watchedChart()) return;
    const canvas = document.getElementById('statistics-watched-chart') as HTMLCanvasElement | null;
    if (!canvas) return;

    this.watchedChart.set(
      new Chart(canvas, {
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
      })
    );
  }

  private createTypeChart(): void {
    if (this.typeChart()) return;
    const canvas = document.getElementById('statistics-type-chart') as HTMLCanvasElement | null;
    if (!canvas) return;

    this.typeChart.set(
      new Chart(canvas, {
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
      })
    );
  }

  private createGenreChart(): void {
    if (this.genreChart()) return;
    const canvas = document.getElementById('statistics-genre-chart') as HTMLCanvasElement | null;
    if (!canvas) return;

    this.genreChart.set(
      new Chart(canvas, {
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
      })
    );
  }

  private updateTagChart(): void {
    const chart = this.tagChart();
    const tagCounts = this.statistics()?.tagCounts ?? [];
    if (!chart) return;

    chart.data.labels = this.selectedTags();
    const data: number[] = [];

    for (const tag of this.selectedTags()) {
      const count = tagCounts.find((tagCount) => tagCount.tag === tag)?.count ?? 0;
      data.push(count);
    }

    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data,
        backgroundColor: this.selectedTags().map((tag) => textToHexColor(tag.replace('#', ''))),
      },
    ];
    chart.update();
  }

  private updateWatchedChart(): void {
    const chart = this.watchedChart();
    const statistics = this.statistics();
    if (!chart || !statistics) return;

    chart.data.labels = [this.ngxSignalTranslate.translate('Watched'), this.ngxSignalTranslate.translate('Unwatched')];
    chart.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data: [statistics.watchedCount, statistics.unwatchedCount],
        backgroundColor: [textToHexColor('watched'), textToHexColor('unwatched')],
      },
    ];
    chart.update();
  }

  private updateTypeChart(): void {
    const chart = this.typeChart();
    const statistics = this.statistics();
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

  private updateGenreChart(): void {
    const chart = this.genreChart();
    const genreCounts = this.statistics()?.genreCounts ?? [];
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

  private loadStatistics(): void {
    this.apiState.setState('loadNetworkStatus', 'pending');
    this.api
      .getStatistics()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.apiState.setState('loadNetworkStatus', 'error');
          return EMPTY;
        })
      )
      .subscribe((statistics) => {
        this.statistics.set(statistics);
        this.apiState.setState('loadNetworkStatus', 'finished');
        this.createTagChart();
        this.createWatchedChart();
        this.createTypeChart();
        this.createGenreChart();
        if (this.tagChart()) this.updateTagChart();
        this.updateWatchedChart();
        this.updateTypeChart();
        this.updateGenreChart();
      });
  }
}
