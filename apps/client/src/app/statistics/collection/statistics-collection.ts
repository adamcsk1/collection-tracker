import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ApiService } from '@services/api/api-service';
import type {
  CollectionItemFiltersApiModel,
  CollectionItemTypeFilter,
  CollectionStatisticsStatus,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { StatisticsBars } from '../bars/statistics-bars';
import { StatisticsItems } from '../items/statistics-items';
import { statisticsStateToken } from '../statistics-store';
import { collectionStatisticsStateToken, initialCollectionState } from './statistics-collection-store';

@Component({
  selector: 'ct-statistics-collection',
  imports: [StatisticsBars, StatisticsItems],
  templateUrl: './statistics-collection.html',
  styleUrl: '../statistics.css',
  host: { class: 'statistics-section' },
  providers: [provideStore(initialCollectionState, collectionStatisticsStateToken)],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsCollection {
  protected readonly root = inject(statisticsStateToken);
  protected readonly store = inject(collectionStatisticsStateToken);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly translations = {
    total: computed(() => this.ngxSignalTranslate.translate('ItemsInCollection')),
    favorites: computed(() => this.ngxSignalTranslate.translate('Favorites')),
    media: computed(() => this.ngxSignalTranslate.translate('MediaTypes')),
    status: computed(() => this.ngxSignalTranslate.translate('Status')),
    genres: computed(() => this.ngxSignalTranslate.translate('Genre')),
    tags: computed(() => this.ngxSignalTranslate.translate('Tags')),
    years: computed(() => this.ngxSignalTranslate.translate('ReleaseYears')),
    ratings: computed(() => this.ngxSignalTranslate.translate('UserRatings')),
    loading: computed(() => this.ngxSignalTranslate.translate('Message.LoadStatistics')),
    error: computed(() => this.ngxSignalTranslate.translate('Toast.LoadStatisticsError')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    empty: computed(() => this.ngxSignalTranslate.translate('Message.EmptyStatistics')),
    labels: computed(() => ({
      movie: this.ngxSignalTranslate.translate('Movies'),
      series: this.ngxSignalTranslate.translate('Series'),
      book: this.ngxSignalTranslate.translate('Books'),
      album: this.ngxSignalTranslate.translate('Music'),
      watched: this.ngxSignalTranslate.translate('Watched'),
      unwatched: this.ngxSignalTranslate.translate('Unwatched'),
      untracked: this.ngxSignalTranslate.translate('Untracked'),
      completed: this.ngxSignalTranslate.translate('Completed'),
      inProgress: this.ngxSignalTranslate.translate('InProgress'),
      read: this.ngxSignalTranslate.translate('Read'),
      unread: this.ngxSignalTranslate.translate('Unread'),
      listened: this.ngxSignalTranslate.translate('Listened'),
      unlistened: this.ngxSignalTranslate.translate('Unlistened'),
    })),
  };
  protected readonly filters = computed(() => {
    const scope = this.root.state.selectedScope();
    return { ...(scope === 'all' ? {} : { type: scope }), ...this.store.state.filters() };
  });
  protected readonly overview = computed(() => {
    const data = this.store.state.data();
    return data?.scope === 'all'
      ? data.charts.mediaTypeCounts.map(({ type, count }) => ({ label: this.label(type), count, value: type }))
      : (data?.charts.statusCounts ?? []).map(({ status, count }) => ({
          label: this.label(status),
          count,
          value: status,
        }));
  });
  protected readonly genres = computed(
    () =>
      this.store.state.data()?.charts.genreCounts.map(({ genre, count }) => ({ label: genre, count, value: genre })) ??
      []
  );
  protected readonly tags = computed(
    () => this.store.state.data()?.charts.tagCounts.map(({ tag, count }) => ({ label: tag, count, value: tag })) ?? []
  );
  protected readonly years = computed(
    () =>
      this.store.state
        .data()
        ?.charts.releaseYearCounts.map(({ year, count }) => ({ label: year, count, value: year })) ?? []
  );
  protected readonly ratings = computed(
    () =>
      this.store.state
        .data()
        ?.charts.userRatingCounts.map(({ rating, count }) => ({ label: `${rating}`, count, value: `${rating}` })) ?? []
  );

  constructor() {
    effect(() => {
      this.root.state.selectedScope();
      untracked(() => {
        this.store.setState('filters', null);
        this.store.setState('data', null);
      });
    });
    toObservable(computed(() => ({ scope: this.root.state.selectedScope(), revision: this.store.state.revision() })))
      .pipe(
        switchMap(({ scope }) => {
          this.store.setState('status', 'pending');
          return this.api.getStatistics(scope === 'all' ? {} : { type: scope }).pipe(
            catchError(() => {
              this.store.setState('status', 'error');
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((data) => {
        this.store.setState('data', data);
        this.store.setState('status', 'finished');
      });
  }
  protected choose(filters: CollectionItemFiltersApiModel, title: string): void {
    this.store.setState('title', title);
    this.store.setState('filters', filters);
    afterNextRender(
      () =>
        this.elementRef.nativeElement.querySelector<HTMLElement>('[data-test-id="statistics-items-heading"]')?.focus(),
      { injector: this.injector }
    );
  }
  protected chooseOverview(value: string): void {
    this.choose({ type: value as CollectionItemTypeFilter }, this.label(value as CollectionItemTypeFilter));
  }
  protected refresh(): void {
    this.store.setState('revision', this.store.state.revision() + 1);
  }
  private label(value: CollectionItemTypeFilter | CollectionStatisticsStatus): string {
    return this.translations.labels()[value];
  }
}
