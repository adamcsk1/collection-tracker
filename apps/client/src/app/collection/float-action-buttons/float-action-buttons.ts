import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { apiStateToken } from '@services/api/api-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainStateToken } from '../../main/main-store';
import { FloatActionButtonsService, FloatActionFilter } from './float-action-buttons-service';

@Component({
  selector: 'ct-float-action-buttons',
  templateUrl: './float-action-buttons.html',
  styleUrl: './float-action-buttons.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatActionButtons implements OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly floatActions = inject(FloatActionsService);
  private readonly actionButtons = inject(FloatActionButtonsService);

  protected readonly translations = {
    addNew: computed(() => this.ngxSignalTranslate.translate('AddNew')),
    searchSwitchButtonLabel: computed(() =>
      this.useAiSearch()
        ? this.ngxSignalTranslate.translate('SwitchToStandardSearch')
        : this.ngxSignalTranslate.translate('SwitchToAiSearch')
    ),
    aiSearch: computed(() => this.ngxSignalTranslate.translate('AiSearch')),
    randomPick: computed(() => this.ngxSignalTranslate.translate('RandomPick')),
    actions: computed(() => this.ngxSignalTranslate.translate('Actions')),
    filtering: computed(() => this.ngxSignalTranslate.translate('Filtering')),
    sorting: computed(() => this.ngxSignalTranslate.translate('Sorting')),
    orderBySwitchButtonLabel: computed(() =>
      this.config().orderBy === 'createdAt'
        ? this.ngxSignalTranslate.translate('SwitchToAlphabetOrder')
        : this.ngxSignalTranslate.translate('SwitchToCreatedAtOrder')
    ),
    orderDirectionSwitchButtonLabel: computed(() =>
      this.config().orderDirection === 'asc'
        ? this.ngxSignalTranslate.translate('SwitchToDescendingOrder')
        : this.ngxSignalTranslate.translate('SwitchToAscendingOrder')
    ),
    hideFunctions: computed(() => this.ngxSignalTranslate.translate('HideFunctions')),
    showFunctions: computed(() => this.ngxSignalTranslate.translate('ShowFunctions')),
    filterMovie: computed(() => this.ngxSignalTranslate.translate('Movies')),
    filterSeries: computed(() => this.ngxSignalTranslate.translate('Series')),
    filterUnwatched: computed(() => this.ngxSignalTranslate.translate('Unwatched')),
    filterCompleted: computed(() => this.ngxSignalTranslate.translate('Completed')),
    filterUncompleted: computed(() => this.ngxSignalTranslate.translate('Uncompleted')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly aiAvailable = this.mainState.state.aiAvailable;
  protected readonly config = this.actionButtons.config;
  protected readonly useAiSearch = computed(() => this.config().useAiSearch);
  protected readonly showAiSearchButton = computed(() => this.config().showAiSearchButton && this.aiAvailable());
  protected readonly aiSearchIcon = computed(() =>
    !this.useAiSearch() && this.aiAvailable() ? 'search' : 'psychology'
  );
  protected readonly orderByIcon = computed(() =>
    this.config().orderBy === 'createdAt' ? 'schedule' : 'sort_by_alpha'
  );
  protected readonly orderDirectionIcon = computed(() =>
    this.config().orderDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'
  );
  protected readonly showFloatButtons = signal(false);
  protected readonly actionButtonsVisible = computed(() => this.config().showActions && this.showFloatButtons());
  protected readonly showActionSection = computed(
    () => this.config().showAddButton || this.showAiSearchButton() || this.config().showRandomPickButton
  );
  protected readonly canShowActionButton = computed(() => {
    const config = this.config();
    return (
      config.showAddButton ||
      this.showAiSearchButton() ||
      config.showRandomPickButton ||
      config.showOrderButtons ||
      config.filterActions.length > 0
    );
  });
  protected readonly addOnlyMode = computed(() => {
    const config = this.config();
    return (
      config.showAddButton &&
      !this.showAiSearchButton() &&
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

  protected onToggleAiSearch(): void {
    this.actionButtons.toggleAiSearch();
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
      completed: 'check_circle',
      uncompleted: 'radio_button_unchecked',
    };

    return icons[filter];
  }

  protected isFilterActive(filter: FloatActionFilter): boolean {
    return this.config().activeFilterActions.includes(filter);
  }
}
