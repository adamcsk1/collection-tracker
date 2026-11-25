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
import { Input } from '@components/input/input';
import { Details } from '@components/details/details';
import { ApiService } from '@services/api/api-service';
import type { CollectionActivityStatus, CollectionItemFiltersApiModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { StatisticsBars } from '../bars/statistics-bars';
import { StatisticsItems } from '../items/statistics-items';
import { statisticsStateToken } from '../statistics-store';
import { activityStateToken, initialActivityState } from './statistics-activity-store';

@Component({
  selector: 'ct-statistics-activity',
  imports: [Input, Details, StatisticsBars, StatisticsItems],
  templateUrl: './statistics-activity.html',
  styleUrl: '../statistics.css',
  host: { class: 'statistics-section' },
  providers: [provideStore(initialActivityState, activityStateToken)],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsActivity {
  protected readonly root = inject(statisticsStateToken);
  protected readonly store = inject(activityStateToken);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  protected readonly currentYear = new Date().getFullYear();
  protected readonly translations = {
    year: computed(() => this.ngxSignalTranslate.translate('Statistics.ActivityYear')),
    thisYear: computed(() => this.ngxSignalTranslate.translate('Statistics.ThisYear')),
    lastYear: computed(() => this.ngxSignalTranslate.translate('Statistics.LastYear')),
    planned: computed(() => this.ngxSignalTranslate.translate('Statistics.Planned', { year: this.root.state.year() })),
    completed: computed(() => this.ngxSignalTranslate.translate('Completed')),
    inProgress: computed(() => this.ngxSignalTranslate.translate('Statistics.CurrentlyInProgress')),
    monthly: computed(() => this.ngxSignalTranslate.translate('Statistics.MonthlyCompletions')),
    allMonths: computed(() => this.ngxSignalTranslate.translate('Statistics.AllMonths')),
    hint: computed(() => this.ngxSignalTranslate.translate('Statistics.HistoryHint')),
    planHint: computed(() => this.ngxSignalTranslate.translate('Statistics.PlanHint')),
    loading: computed(() => this.ngxSignalTranslate.translate('Message.LoadStatistics')),
    error: computed(() => this.ngxSignalTranslate.translate('Toast.LoadStatisticsError')),
    retry: computed(() => this.ngxSignalTranslate.translate('Retry')),
    validationYear: computed(() => this.ngxSignalTranslate.translate('Statistics.ValidationYear')),
    monthNames: computed(() => [
      this.ngxSignalTranslate.translate('Statistics.Month1'),
      this.ngxSignalTranslate.translate('Statistics.Month2'),
      this.ngxSignalTranslate.translate('Statistics.Month3'),
      this.ngxSignalTranslate.translate('Statistics.Month4'),
      this.ngxSignalTranslate.translate('Statistics.Month5'),
      this.ngxSignalTranslate.translate('Statistics.Month6'),
      this.ngxSignalTranslate.translate('Statistics.Month7'),
      this.ngxSignalTranslate.translate('Statistics.Month8'),
      this.ngxSignalTranslate.translate('Statistics.Month9'),
      this.ngxSignalTranslate.translate('Statistics.Month10'),
      this.ngxSignalTranslate.translate('Statistics.Month11'),
      this.ngxSignalTranslate.translate('Statistics.Month12'),
    ]),
  };
  protected readonly cards = computed(() => [
    { status: 'planned' as const, label: this.translations.planned(), count: this.store.state.data()?.planned ?? 0 },
    {
      status: 'completed' as const,
      label: this.translations.completed(),
      count: this.store.state.data()?.completed ?? 0,
    },
    {
      status: 'inProgress' as const,
      label: this.translations.inProgress(),
      count: this.store.state.data()?.inProgress ?? 0,
    },
  ]);
  protected readonly selectedTitle = computed(() => {
    const label = this.cards().find((card) => card.status === this.store.state.selected())!.label;
    return this.store.state.selected() !== 'completed'
      ? label
      : `${label} · ${this.root.state.year()}${this.store.state.month() ? ' · ' + this.translations.monthNames()[this.store.state.month()! - 1] : ''}`;
  });
  protected readonly months = computed(() =>
    (this.store.state.data()?.months ?? []).map(({ month, count }) => ({
      label: this.translations.monthNames()[month - 1],
      count,
      value: `${month}`,
    }))
  );
  protected readonly filters = computed<CollectionItemFiltersApiModel>(() => {
    const scope = this.root.state.selectedScope();
    return {
      activityYear: this.root.state.year(),
      activityStatus: this.store.state.selected(),
      activityMonth: this.store.state.month() ?? undefined,
      type: scope === 'all' ? undefined : scope,
    };
  });

  constructor() {
    effect(() => {
      this.root.state.year();
      this.root.state.selectedScope();
      untracked(() => this.store.setState('data', null));
    });
    toObservable(
      computed(() => ({
        year: this.root.state.year(),
        scope: this.root.state.selectedScope(),
        revision: this.store.state.revision(),
      }))
    )
      .pipe(
        switchMap(({ year, scope }) => {
          this.store.setState('status', 'pending');
          return this.api.getCollectionActivity(year, scope === 'all' ? undefined : scope).pipe(
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
  protected select(status: CollectionActivityStatus): void {
    this.store.setState('month', null);
    this.store.setState('selected', status);
    this.focusResults();
  }
  protected selectMonth(month: string): void {
    this.store.setState('selected', 'completed');
    this.store.setState('month', Number(month));
    this.focusResults();
  }
  protected setYear(value: string | null): void {
    if (value !== null && /^[1-9]\d{3}$/.test(value)) this.root.setState('year', Number(value));
  }
  protected refresh(): void {
    this.store.setState('revision', this.store.state.revision() + 1);
  }
  private focusResults(): void {
    afterNextRender(
      () =>
        this.elementRef.nativeElement.querySelector<HTMLElement>('[data-test-id="statistics-items-heading"]')?.focus(),
      { injector: this.injector }
    );
  }
}
