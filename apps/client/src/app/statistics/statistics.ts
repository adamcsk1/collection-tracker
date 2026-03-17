import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { StatisticsSummaryModel } from '@client/statistics/statistics-model';
import { Details } from '@components/details/details';
import { apiStateToken } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';
import { textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslatePipe, NgxSignalTranslateService } from 'ngx-signal-translate';

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
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly apiState = inject(apiStateToken);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly tags = computed(() => [
    ...new Set(
      this.mainCollectionState.state
        .collection()
        .flatMap((item) => item.tags)
        .sort((a, b) => (a.length > b.length ? 1 : b.length > a.length ? -1 : 0))
    ),
  ]);
  protected readonly chart = signal<Chart<'pie', number[], string> | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly summary = computed<StatisticsSummaryModel>(() => {
    const collection = this.mainCollectionState.state.collection();
    const summary = {
      movies: collection.filter((item) => item.tags.includes(MOVIE_TAG)).length,
      series: collection.filter((item) => item.tags.includes(SERIES_TAG)).length,
    };
    return { ...summary, all: collection.length };
  });
  protected readonly defaultOpenSelectedTags: boolean;

  constructor() {
    const storedTags = this.webstorage.getItem(STORAGE_STATISTICS_SELECTED_TAGS);
    if (storedTags) this.selectedTags.set(JSON.parse(storedTags));
    this.defaultOpenSelectedTags = this.selectedTags().length === 0;
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
    const collection = this.mainCollectionState.state.collection();
    const chart = this.chart();
    chart!.data.labels = this.selectedTags();
    const data: number[] = [];

    for (const tag of this.selectedTags()) {
      const count = collection.filter((item) => item.tags.includes(tag)).length;
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
}
