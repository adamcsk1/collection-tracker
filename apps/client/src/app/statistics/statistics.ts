import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { CollectionItemTypeFilter, CollectionStatisticsStatus } from '@shared/models/api-model';
import { textToContrastColor, textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { catchError, EMPTY, of, switchMap, tap } from 'rxjs';
import type { CollectionMediaChip } from '../collection/media-chips/media-chips-model';
import { CollectionMediaChips } from '../collection/media-chips/media-chips';
import { mainStateToken } from '../main/main-store';
import { StatisticsChartService } from './statistics-chart-service';
import { initialStatisticsState, statisticsStateToken } from './statistics-store';

@Component({
  selector: 'ct-statistics',
  imports: [CollectionMediaChips, Details, Input],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  providers: [StatisticsChartService, provideStore(initialStatisticsState, statisticsStateToken)],
  host: { class: 'page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly statisticsState = inject(statisticsStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly portal = inject(PortalService);
  private readonly charts = inject(StatisticsChartService);
  protected readonly featurePreferences = inject(mainStateToken).state.collectionFeaturePreferences;
  protected readonly translations = {
    statistics: computed(() => this.ngxSignalTranslate.translate('Statistics')),
    messageLoadStatistics: computed(() => this.ngxSignalTranslate.translate('Message.LoadStatistics')),
    messageEmptyStatistics: computed(() => this.ngxSignalTranslate.translate('Message.EmptyStatistics')),
    loadStatisticsError: computed(() => this.ngxSignalTranslate.translate('Toast.LoadStatisticsError')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    messageEmptyTags: computed(() => this.ngxSignalTranslate.translate('Message.EmptyTags')),
    summary: computed(() => this.ngxSignalTranslate.translate('Summary')),
    itemsInCollection: computed(() => this.ngxSignalTranslate.translate('ItemsInCollection')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
    books: computed(() => this.ngxSignalTranslate.translate('Books')),
    favorites: computed(() => this.ngxSignalTranslate.translate('Favorites')),
    watched: computed(() => this.ngxSignalTranslate.translate('Watched')),
    unwatched: computed(() => this.ngxSignalTranslate.translate('Unwatched')),
    tracked: computed(() => this.ngxSignalTranslate.translate('Tracked')),
    untracked: computed(() => this.ngxSignalTranslate.translate('Untracked')),
    completed: computed(() => this.ngxSignalTranslate.translate('Completed')),
    inProgress: computed(() => this.ngxSignalTranslate.translate('InProgress')),
    read: computed(() => this.ngxSignalTranslate.translate('Read')),
    unread: computed(() => this.ngxSignalTranslate.translate('Unread')),
    charts: computed(() => this.ngxSignalTranslate.translate('Charts')),
    availableTags: computed(() => this.ngxSignalTranslate.translate('AvailableTags')),
    clearSelectedTags: computed(() => this.ngxSignalTranslate.translate('ClearSelectedTags')),
    selectedTags: computed(() => this.ngxSignalTranslate.translate('SelectedTags')),
    placeholderFilterTags: computed(() => this.ngxSignalTranslate.translate('Placeholder.FilterTags')),
    messageEmptySelectTagsForChart: computed(() =>
      this.ngxSignalTranslate.translate('Message.EmptySelectTagsForChart')
    ),
    messageEmptyTagFilter: computed(() => this.ngxSignalTranslate.translate('Message.EmptyTagFilter')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    mediaTypes: computed(() => this.ngxSignalTranslate.translate('MediaTypes')),
    status: computed(() => this.ngxSignalTranslate.translate('Status')),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    releaseYears: computed(() => this.ngxSignalTranslate.translate('ReleaseYears')),
    userRatings: computed(() => this.ngxSignalTranslate.translate('UserRatings')),
  };
  protected readonly statisticsLoadStatus = this.statisticsState.state.loadStatus;
  protected readonly selectedScope = this.statisticsState.state.selectedScope;
  protected readonly statistics = this.statisticsState.state.statistics;
  protected readonly tags = computed(() => this.statistics()?.charts.tagCounts.map(({ tag }) => tag) ?? []);
  protected readonly applicableSelectedTags = computed(() => {
    const availableTags = new Set(this.tags());
    return this.selectedTags().filter((tag) => availableTags.has(tag));
  });
  protected readonly tagChart = signal<Chart<'pie', number[], string> | null>(null);
  protected readonly overviewChart = signal<Chart<'doughnut', number[], string> | null>(null);
  protected readonly genreChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly releaseYearChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly ratingChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly tagFilter = signal('');
  protected readonly normalizedTagFilter = computed(() => this.tagFilter().trim().toLowerCase());
  protected readonly hasActiveTagFilter = computed(() => this.normalizedTagFilter().length > 0);
  protected readonly selectedTagSet = computed(() => new Set(this.applicableSelectedTags()));
  protected readonly filteredTags = computed(() => {
    const filter = this.normalizedTagFilter();
    return filter ? this.tags().filter((tag) => tag.toLowerCase().includes(filter)) : this.tags();
  });
  protected readonly selectedVisibleTags = computed(() =>
    this.filteredTags().filter((tag) => this.selectedTagSet().has(tag))
  );
  protected readonly availableVisibleTags = computed(() =>
    this.filteredTags().filter((tag) => !this.selectedTagSet().has(tag))
  );
  protected readonly tagChartDescription = computed(() => {
    const countByTag = new Map(this.statistics()?.charts.tagCounts.map(({ tag, count }) => [tag, count]) ?? []);
    return this.describeChart(
      this.translations.tags(),
      this.applicableSelectedTags().map((tag) => ({ label: tag, count: countByTag.get(tag) ?? 0 }))
    );
  });
  protected readonly overviewChartDescription = computed(() => {
    const statistics = this.statistics();
    const title = statistics?.scope === 'all' ? this.translations.mediaTypes() : this.translations.status();
    const entries =
      statistics?.scope === 'all'
        ? statistics.charts.mediaTypeCounts.map(({ type, count }) => ({
            label: this.translateChartLabel(type),
            count,
          }))
        : (statistics?.charts.statusCounts ?? []).map(({ status, count }) => ({
            label: this.translateChartLabel(status),
            count,
          }));
    return this.describeChart(title, entries);
  });
  protected readonly genreChartDescription = computed(() =>
    this.describeChart(
      this.translations.genre(),
      [...(this.statistics()?.charts.genreCounts ?? [])]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ genre, count }) => ({ label: genre, count }))
    )
  );
  protected readonly releaseYearChartDescription = computed(() =>
    this.describeChart(
      this.translations.releaseYears(),
      (this.statistics()?.charts.releaseYearCounts ?? []).map(({ year, count }) => ({ label: year, count }))
    )
  );
  protected readonly ratingChartDescription = computed(() =>
    this.describeChart(
      this.translations.userRatings(),
      (this.statistics()?.charts.userRatingCounts ?? []).map(({ rating, count }) => ({ label: `${rating}`, count }))
    )
  );
  protected readonly defaultOpenSelectedTags: boolean;
  protected readonly textToHexColor = textToHexColor;
  protected readonly textToContrastColor = textToContrastColor;

  constructor() {
    const storedTags = this.webstorage.getItem(STORAGE_STATISTICS_SELECTED_TAGS);
    if (storedTags !== null) {
      try {
        const parsedTags = JSON.parse(storedTags) as unknown;
        if (Array.isArray(parsedTags) && parsedTags.every((tag) => typeof tag === 'string')) {
          this.selectedTags.set(parsedTags);
        } else {
          this.webstorage.removeItem(STORAGE_STATISTICS_SELECTED_TAGS);
        }
      } catch {
        this.webstorage.removeItem(STORAGE_STATISTICS_SELECTED_TAGS);
      }
    }
    this.defaultOpenSelectedTags = this.selectedTags().length === 0;

    afterRenderEffect(() => {
      const statistics = this.statistics();
      const networkStatus = this.statisticsLoadStatus();
      this.applicableSelectedTags();
      if (!statistics || networkStatus !== 'finished') return;
      untracked(() => {
        this.createCharts();
        this.resizeCharts();
        this.refreshCharts();
      });
    });

    const loadTrigger = computed(() => ({
      scope: this.selectedScope(),
      reloadVersion: this.statisticsState.state.reloadVersion(),
    }));

    toObservable(loadTrigger)
      .pipe(
        tap(() => this.statisticsState.setState('loadStatus', 'pending')),
        switchMap(({ scope }) => {
          const cached = this.statisticsState.state.cache()[scope];
          if (cached) return of(cached);
          return this.api.getStatistics(scope === 'all' ? {} : { type: scope }).pipe(
            tap((statistics) =>
              this.statisticsState.setState('cache', { ...this.statisticsState.state.cache(), [scope]: statistics })
            ),
            catchError(() => {
              this.statisticsState.setState('loadStatus', 'error');
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((statistics) => {
        this.statisticsState.setState('statistics', statistics);
        this.statisticsState.setState('loadStatus', 'finished');
      });
  }

  public ngOnDestroy(): void {
    this.tagChart()?.destroy();
    this.overviewChart()?.destroy();
    this.genreChart()?.destroy();
    this.releaseYearChart()?.destroy();
    this.ratingChart()?.destroy();
  }

  protected onSelectScope(scope: CollectionMediaChip): void {
    this.statisticsState.setState('selectedScope', scope);
    this.statisticsState.setState('statistics', null);
    this.statisticsState.setState('loadStatus', 'pending');
    this.statisticsState.setState('reloadVersion', this.statisticsState.state.reloadVersion() + 1);
    this.tagFilter.set('');
  }

  protected onRetryLoadStatistics(): void {
    this.statisticsState.setState('loadStatus', 'pending');
    this.statisticsState.setState('reloadVersion', this.statisticsState.state.reloadVersion() + 1);
  }

  protected onToggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((selectedTag) => selectedTag !== tag) : [...tags, tag]
    );
    this.persistSelectedTags();
  }

  protected onFilterTags(value: string | null): void {
    this.tagFilter.set(value ?? '');
  }

  protected onClearSelectedTags(): void {
    const applicable = new Set(this.applicableSelectedTags());
    this.selectedTags.update((tags) => tags.filter((tag) => !applicable.has(tag)));
    this.persistSelectedTags();
  }

  protected navigateToCollection(type?: 'movie' | 'series' | 'book', filters: Record<string, unknown> = {}): void {
    const route = type === 'book' ? ['/collection', 'books'] : ['/collection', 'library'];
    const queryParams = { ...(type && type !== 'book' ? { type } : {}), ...filters };
    this.closeAfterNavigation(
      this.router.navigate(route, Object.keys(queryParams).length ? { queryParams } : undefined)
    );
  }

  protected navigateToTracking(type: 'movie' | 'series' | 'book', filters: Record<string, unknown> = {}): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'tracking'], { queryParams: { type, ...filters } }));
  }

  private closeAfterNavigation(navigation: Promise<boolean>): void {
    void navigation.then((success) => {
      if (success) this.portal.closeAll();
    });
  }

  private createCharts(): void {
    this.tagChart.set(this.charts.createTagChart(this.tagChart()));
    this.overviewChart.set(this.charts.createOverviewChart(this.overviewChart()));
    this.genreChart.set(this.charts.createGenreChart(this.genreChart()));
    this.releaseYearChart.set(this.charts.createReleaseYearChart(this.releaseYearChart()));
    this.ratingChart.set(this.charts.createRatingChart(this.ratingChart()));
  }

  private refreshCharts(): void {
    const statistics = this.statistics();
    if (!statistics) return;
    this.updateTagChart();
    this.charts.updateOverviewChart(this.overviewChart(), statistics);
    this.charts.updateGenreChart(this.genreChart(), statistics.charts.genreCounts);
    this.charts.updateReleaseYearChart(this.releaseYearChart(), statistics.charts.releaseYearCounts);
    this.charts.updateRatingChart(this.ratingChart(), statistics.charts.userRatingCounts);
  }

  private updateTagChart(): void {
    this.charts.updateTagChart(
      this.tagChart(),
      this.statistics()?.charts.tagCounts ?? [],
      this.applicableSelectedTags()
    );
  }

  private resizeCharts(): void {
    this.tagChart()?.resize();
    this.overviewChart()?.resize();
    this.genreChart()?.resize();
    this.releaseYearChart()?.resize();
    this.ratingChart()?.resize();
  }

  private describeChart(title: string, entries: Array<{ label: string; count: number }>): string {
    const data = entries
      .map(({ label, count }) => this.ngxSignalTranslate.translate('Aria.ChartDataPoint', { label, count }))
      .join(', ');
    return this.ngxSignalTranslate.translate('Aria.ChartSummary', { title, data });
  }

  private translateChartLabel(key: CollectionItemTypeFilter | CollectionStatisticsStatus): string {
    const translationKeys: Record<typeof key, string> = {
      movie: 'Movies',
      series: 'Series',
      book: 'Books',
      watched: 'Watched',
      unwatched: 'Unwatched',
      untracked: 'Untracked',
      completed: 'Completed',
      inProgress: 'InProgress',
      read: 'Read',
      unread: 'Unread',
    };
    return this.ngxSignalTranslate.translate(translationKeys[key]);
  }

  private persistSelectedTags(): void {
    this.webstorage.setItem(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(this.selectedTags()));
  }
}
