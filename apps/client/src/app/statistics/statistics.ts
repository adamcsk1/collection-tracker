import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly statistics = signal<CollectionStatisticsApiResponseModel | null>(null);
  protected readonly tags = computed(() => this.statistics()?.tagCounts.map((tagCount) => tagCount.tag) ?? []);
  protected readonly chart = signal<Chart<'pie', number[], string> | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly summary = computed<StatisticsSummaryModel>(() => {
    const statistics = this.statistics();
    return {
      movies: statistics?.movieCount ?? 0,
      series: statistics?.seriesCount ?? 0,
      all: statistics?.totalItems ?? 0,
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
    this.chart.set(
      new Chart('statistics', {
        type: 'pie',
        data: {
          labels: [],
          datasets: [],
        },
      })
    );

    if (this.selectedTags().length > 0) this.updateChartData();
  }

  public onToggleTag(tag: string): void {
    const currentTags = this.selectedTags();
    if (currentTags.includes(tag)) {
      this.selectedTags.update((selectedTags) => selectedTags.filter((selectedTag) => selectedTag !== tag));
    } else this.selectedTags.update((selectedTags) => [...selectedTags, tag]);

    this.webstorage.setItem(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(this.selectedTags()));
    this.updateChartData();
  }

  private updateChartData(): void {
    const chart = this.chart();
    const tagCounts = this.statistics()?.tagCounts ?? [];
    chart!.data.labels = this.selectedTags();
    const data: number[] = [];

    for (const tag of this.selectedTags()) {
      const count = tagCounts.find((tagCount) => tagCount.tag === tag)?.count ?? 0;
      data.push(count);
    }

    chart!.data.datasets = [
      {
        label: this.ngxSignalTranslate.translate('Count'),
        data,
        backgroundColor: this.selectedTags().map((tag) => textToHexColor(tag.replace('#', ''))),
      },
    ];
    chart!.update();
  }

  private loadStatistics(): void {
    this.apiState.setState('loadNetworkStatus', 'pending');
    this.api
      .getStatistics()
      .pipe(
        catchError(() => {
          this.apiState.setState('loadNetworkStatus', 'error');
          return EMPTY;
        })
      )
      .subscribe((statistics) => {
        this.statistics.set(statistics);
        this.apiState.setState('loadNetworkStatus', 'finished');
        if (this.chart()) this.updateChartData();
      });
  }
}
