import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StatisticsSummaryModel } from './statistics-model';
import { Details } from '@components/details/details';
import { Input } from '@components/input/input';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import { textToHexColor } from '@shared/utils/text-to-hex-color-util';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { catchError, EMPTY } from 'rxjs';
import { StatisticsChartService } from './statistics-chart-service';

@Component({
  selector: 'ct-statistics',
  imports: [Details, Input],
  templateUrl: './statistics.html',
  styleUrl: './statistics.css',
  providers: [StatisticsChartService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Statistics implements AfterViewInit {
  private readonly api = inject(ApiService);
  private readonly webstorage = inject(WebstorageService);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly apiState = inject(apiStateToken);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly portal = inject(PortalService);
  private readonly charts = inject(StatisticsChartService);
  protected readonly translations = {
    messageLoadStatistics: computed(() => this.ngxSignalTranslate.translate('Message.LoadStatistics')),
    messageEmptyStatistics: computed(() => this.ngxSignalTranslate.translate('Message.EmptyStatistics')),
    messageEmptyTags: computed(() => this.ngxSignalTranslate.translate('Message.EmptyTags')),
    summary: computed(() => this.ngxSignalTranslate.translate('Summary')),
    itemsInCollection: computed(() => this.ngxSignalTranslate.translate('ItemsInCollection')),
    movies: computed(() => this.ngxSignalTranslate.translate('Movies')),
    series: computed(() => this.ngxSignalTranslate.translate('Series')),
    favorites: computed(() => this.ngxSignalTranslate.translate('Favorites')),
    watchLater: computed(() => this.ngxSignalTranslate.translate('WatchLater')),
    wishlist: computed(() => this.ngxSignalTranslate.translate('Wishlist')),
    watchedMovies: computed(() => this.ngxSignalTranslate.translate('WatchedMovies')),
    watchedSeries: computed(() => this.ngxSignalTranslate.translate('WatchedSeries')),
    unwatchedMovies: computed(() => this.ngxSignalTranslate.translate('UnwatchedMovies')),
    unwatchedLibrarySeries: computed(() => this.ngxSignalTranslate.translate('UnwatchedLibrarySeries')),
    unwatchedTrackerSeries: computed(() => this.ngxSignalTranslate.translate('UnwatchedTrackerSeries')),
    completedTrackerSeries: computed(() => this.ngxSignalTranslate.translate('CompletedTrackerSeries')),
    chart: computed(() => this.ngxSignalTranslate.translate('Chart')),
    availableTags: computed(() => this.ngxSignalTranslate.translate('AvailableTags')),
    clearSelectedTags: computed(() => this.ngxSignalTranslate.translate('ClearSelectedTags')),
    selectedTags: computed(() => this.ngxSignalTranslate.translate('SelectedTags')),
    placeholderFilterTags: computed(() => this.ngxSignalTranslate.translate('Placeholder.FilterTags')),
    messageEmptySelectTagsForChart: computed(() =>
      this.ngxSignalTranslate.translate('Message.EmptySelectTagsForChart')
    ),
    messageEmptyTagFilter: computed(() => this.ngxSignalTranslate.translate('Message.EmptyTagFilter')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    trackerStatus: computed(() => this.ngxSignalTranslate.translate('TrackerStatus')),
    type: computed(() => this.ngxSignalTranslate.translate('Type')),
    genre: computed(() => this.ngxSignalTranslate.translate('Genre')),
    watchedByYear: computed(() => this.ngxSignalTranslate.translate('WatchedByYear')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly statistics = signal<CollectionStatisticsApiResponseModel | null>(null);
  protected readonly tags = computed(() => this.statistics()?.tagCounts.map((tagCount) => tagCount.tag) ?? []);
  protected readonly tagChart = signal<Chart<'pie', number[], string> | null>(null);
  protected readonly watchedChart = signal<Chart<'doughnut', number[], string> | null>(null);
  protected readonly typeChart = signal<Chart<'doughnut', number[], string> | null>(null);
  protected readonly genreChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly watchedYearChart = signal<Chart<'bar', number[], string> | null>(null);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly tagFilter = signal('');
  protected readonly normalizedTagFilter = computed(() => this.tagFilter().trim().toLowerCase());
  protected readonly hasActiveTagFilter = computed(() => this.normalizedTagFilter().length > 0);
  protected readonly selectedTagSet = computed(() => new Set(this.selectedTags()));
  protected readonly filteredTags = computed(() => {
    const tagFilter = this.normalizedTagFilter();
    const tags = this.tags();
    return tagFilter ? tags.filter((tag) => tag.toLowerCase().includes(tagFilter)) : tags;
  });
  protected readonly selectedVisibleTags = computed(() =>
    this.filteredTags().filter((tag) => this.selectedTagSet().has(tag))
  );
  protected readonly availableVisibleTags = computed(() =>
    this.filteredTags().filter((tag) => !this.selectedTagSet().has(tag))
  );
  protected readonly summary = computed<StatisticsSummaryModel>(() => {
    const statistics = this.statistics();
    return {
      movies: statistics?.movieCount ?? 0,
      series: statistics?.seriesCount ?? 0,
      favorites: statistics?.favoriteCount ?? 0,
      watchLater: statistics?.watchLaterCount ?? 0,
      wishlist: statistics?.wishlistCount ?? 0,
      all: statistics?.totalItems ?? 0,
      watchedMovies: statistics?.watchedMovieCount ?? 0,
      watchedSeries: statistics?.watchedSeriesCount ?? 0,
      unwatchedMovies: statistics?.unwatchedMovieCount ?? 0,
      unwatchedLibrarySeries: statistics?.unwatchedLibrarySeriesCount ?? 0,
      unwatchedTrackerSeries: statistics?.unwatchedTrackerSeriesCount ?? 0,
      completedTrackerSeries: statistics?.completedTrackerSeriesCount ?? 0,
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
    this.createWatchedYearChart();

    if (this.selectedTags().length > 0) this.updateTagChart();
    this.updateWatchedChart();
    this.updateTypeChart();
    this.updateGenreChart();
    this.updateWatchedYearChart();
  }

  public onToggleTag(tag: string): void {
    const currentTags = this.selectedTags();
    if (currentTags.includes(tag)) {
      this.selectedTags.update((selectedTags) => selectedTags.filter((selectedTag) => selectedTag !== tag));
    } else this.selectedTags.update((selectedTags) => [...selectedTags, tag]);

    this.persistSelectedTags();
    this.updateTagChart();
  }

  protected onFilterTags(value: string | null): void {
    this.tagFilter.set(value ?? '');
  }

  protected onClearSelectedTags(): void {
    this.selectedTags.set([]);
    this.persistSelectedTags();
    this.updateTagChart();
  }

  protected readonly textToHexColor = textToHexColor;

  protected onNavigateToCollection(search?: string): void {
    const navigation = search
      ? this.router.navigate(['/collection', 'library'], { queryParams: { search } })
      : this.router.navigate(['/collection', 'library']);

    this.closeAfterNavigation(navigation);
  }

  protected onNavigateToCollectionType(type: 'movie' | 'series'): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'library'], { queryParams: { type } }));
  }

  protected onNavigateToWatchLater(): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'watch-later']));
  }

  protected onNavigateToWishlist(): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'wishlist']));
  }

  protected onNavigateToFavorites(): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'favorites']));
  }

  protected onNavigateToMovieTracker(): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'movie-tracker']));
  }

  protected onNavigateToSeriesTracker(): void {
    this.closeAfterNavigation(this.router.navigate(['/collection', 'series-tracker']));
  }

  protected onNavigateToUnwatchedMovies(): void {
    this.closeAfterNavigation(
      this.router.navigate(['/collection', 'library'], { queryParams: { watched: false, type: 'movie' } })
    );
  }

  protected onNavigateToUnwatchedLibrarySeries(): void {
    this.closeAfterNavigation(
      this.router.navigate(['/collection', 'library'], { queryParams: { watched: false, type: 'series' } })
    );
  }

  protected onNavigateToUnwatchedTrackerSeries(): void {
    this.closeAfterNavigation(
      this.router.navigate(['/collection', 'series-tracker'], { queryParams: { completed: false } })
    );
  }

  protected onNavigateToCompletedTrackerSeries(): void {
    this.closeAfterNavigation(
      this.router.navigate(['/collection', 'series-tracker'], { queryParams: { completed: true } })
    );
  }

  private closeAfterNavigation(navigation: Promise<boolean>): void {
    void navigation.then((success) => {
      if (success) this.portal.closeAll();
    });
  }

  private createTagChart(): void {
    this.tagChart.set(this.charts.createTagChart(this.tagChart()));
  }

  private createWatchedChart(): void {
    this.watchedChart.set(this.charts.createWatchedChart(this.watchedChart()));
  }

  private createTypeChart(): void {
    this.typeChart.set(this.charts.createTypeChart(this.typeChart()));
  }

  private createGenreChart(): void {
    this.genreChart.set(this.charts.createGenreChart(this.genreChart()));
  }

  private createWatchedYearChart(): void {
    this.watchedYearChart.set(this.charts.createWatchedYearChart(this.watchedYearChart()));
  }

  private updateTagChart(): void {
    this.charts.updateTagChart(this.tagChart(), this.statistics(), this.selectedTags());
  }

  private updateWatchedChart(): void {
    this.charts.updateWatchedChart(this.watchedChart(), this.statistics());
  }

  private updateTypeChart(): void {
    this.charts.updateTypeChart(this.typeChart(), this.statistics());
  }

  private updateGenreChart(): void {
    this.charts.updateGenreChart(this.genreChart(), this.statistics());
  }

  private updateWatchedYearChart(): void {
    this.charts.updateWatchedYearChart(this.watchedYearChart(), this.statistics());
  }

  private persistSelectedTags(): void {
    this.webstorage.setItem(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(this.selectedTags()));
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
        this.createWatchedYearChart();
        if (this.tagChart()) this.updateTagChart();
        this.updateWatchedChart();
        this.updateTypeChart();
        this.updateGenreChart();
        this.updateWatchedYearChart();
      });
  }
}
