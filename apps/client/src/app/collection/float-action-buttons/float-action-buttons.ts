import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { CollectionItemOrderBy, CollectionItemOrderDirection } from '@shared/models/api-model';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { FloatActionFilter } from './float-action-buttons-model';
import { FloatActionButtonsService } from './float-action-buttons-service';

@Component({
  selector: 'ct-float-action-buttons',
  templateUrl: './float-action-buttons.html',
  styleUrl: './float-action-buttons.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatActionButtons implements OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly apiState = inject(apiStateToken);
  private readonly floatActions = inject(FloatActionsService);
  private readonly actionButtons = inject(FloatActionButtonsService);

  protected readonly translations = {
    addNew: computed(() => this.ngxSignalTranslate.translate('AddNew')),
    randomPick: computed(() => this.ngxSignalTranslate.translate('RandomPick')),
    actions: computed(() => this.ngxSignalTranslate.translate('Actions')),
    filtering: computed(() => this.ngxSignalTranslate.translate('Filtering')),
    sorting: computed(() => this.ngxSignalTranslate.translate('Sorting')),
    orderByCreatedAt: computed(() => this.ngxSignalTranslate.translate('SwitchToCreatedAtOrder')),
    orderByAlphabet: computed(() => this.ngxSignalTranslate.translate('SwitchToAlphabetOrder')),
    orderDirectionDescending: computed(() => this.ngxSignalTranslate.translate('SwitchToDescendingOrder')),
    orderDirectionAscending: computed(() => this.ngxSignalTranslate.translate('SwitchToAscendingOrder')),
    orderByCreatedAtShort: computed(() => this.ngxSignalTranslate.translate('SortCreatedAtShort')),
    orderByAlphabetShort: computed(() => this.ngxSignalTranslate.translate('SortAlphabetShort')),
    orderDirectionDescendingShort: computed(() => this.ngxSignalTranslate.translate('SortDescendingShort')),
    orderDirectionAscendingShort: computed(() => this.ngxSignalTranslate.translate('SortAscendingShort')),
    hideFunctions: computed(() => this.ngxSignalTranslate.translate('HideFunctions')),
    showFunctions: computed(() => this.ngxSignalTranslate.translate('ShowFunctions')),
    filterMovie: computed(() => this.ngxSignalTranslate.translate('Movies')),
    filterSeries: computed(() => this.ngxSignalTranslate.translate('Series')),
    filterUnwatched: computed(() => this.ngxSignalTranslate.translate('Unwatched')),
    filterFavorite: computed(() => this.ngxSignalTranslate.translate('Favorites')),
    filterCompleted: computed(() => this.ngxSignalTranslate.translate('Completed')),
    filterUncompleted: computed(() => this.ngxSignalTranslate.translate('Uncompleted')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly config = this.actionButtons.config;
  protected readonly showFloatButtons = signal(false);
  protected readonly actionButtonsVisible = computed(() => this.config().showActions && this.showFloatButtons());
  protected readonly rowFilterActions = computed(() =>
    this.config().filterActions.filter((filter) => filter === 'movie' || filter === 'series')
  );
  protected readonly stackedFilterActions = computed(() =>
    this.config().filterActions.filter((filter) => filter !== 'movie' && filter !== 'series')
  );
  protected readonly showActionSection = computed(
    () => this.config().showAddButton || this.config().showRandomPickButton
  );
  protected readonly canShowActionButton = computed(() => {
    const config = this.config();
    return (
      config.showAddButton || config.showRandomPickButton || config.showOrderButtons || config.filterActions.length > 0
    );
  });
  protected readonly addOnlyMode = computed(() => {
    const config = this.config();
    return (
      config.showAddButton &&
      !config.showRandomPickButton &&
      !config.showOrderButtons &&
      config.filterActions.length === 0
    );
  });
  protected readonly showFloatActions = computed(() => this.config().showActions && this.canShowActionButton());

  constructor() {
    effect(() => {
      if (!this.config().showActions) {
        this.showFloatButtons.set(false);
      }
    });

    effect(() => {
      this.floatActions.setActionButtonsVisible(this.actionButtonsVisible());
    });
  }

  public ngOnDestroy(): void {
    this.floatActions.setActionButtonsVisible(false);
  }

  protected onShowFunctions(): void {
    if (!this.showFloatActions()) return;
    if (this.addOnlyMode()) {
      this.onAddNew();
      return;
    }

    this.showFloatButtons.set(true);
    this.actionButtons.showFunctions();
  }

  protected onHideFunctions(): void {
    this.showFloatButtons.set(false);
  }

  protected onRandomPick(): void {
    this.actionButtons.randomPick();
    this.showFloatButtons.set(false);
  }

  protected onToggleOrderBy(): void {
    this.actionButtons.toggleOrderBy();
    this.showFloatButtons.set(false);
  }

  protected onToggleOrderDirection(): void {
    this.actionButtons.toggleOrderDirection();
    this.showFloatButtons.set(false);
  }

  protected onSelectOrderBy(orderBy: CollectionItemOrderBy): void {
    if (this.isOrderByActive(orderBy)) return;
    this.onToggleOrderBy();
  }

  protected onSelectOrderDirection(orderDirection: CollectionItemOrderDirection): void {
    if (this.isOrderDirectionActive(orderDirection)) return;
    this.onToggleOrderDirection();
  }

  protected onApplyFilter(filter: FloatActionFilter): void {
    this.actionButtons.applyFilter(filter);
    this.showFloatButtons.set(false);
  }

  protected onAddNew(): void {
    this.actionButtons.addNew();
    this.showFloatButtons.set(false);
  }

  protected filterActionLabel(filter: FloatActionFilter): string {
    const labels: Record<FloatActionFilter, string> = {
      movie: this.translations.filterMovie(),
      series: this.translations.filterSeries(),
      unwatched: this.translations.filterUnwatched(),
      favorite: this.translations.filterFavorite(),
      completed: this.translations.filterCompleted(),
      uncompleted: this.translations.filterUncompleted(),
    };

    return labels[filter];
  }

  protected filterActionIcon(filter: FloatActionFilter): string {
    const icons: Record<FloatActionFilter, string> = {
      movie: 'movie',
      series: 'live_tv',
      unwatched: 'visibility_off',
      favorite: 'star',
      completed: 'check_circle',
      uncompleted: 'radio_button_unchecked',
    };

    return icons[filter];
  }

  protected isFilterActive(filter: FloatActionFilter): boolean {
    return this.config().activeFilterActions.includes(filter);
  }

  protected isOrderByActive(orderBy: CollectionItemOrderBy): boolean {
    return this.config().orderBy === orderBy;
  }

  protected isOrderDirectionActive(orderDirection: CollectionItemOrderDirection): boolean {
    return this.config().orderDirection === orderDirection;
  }
}
