import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

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
    filterBook: computed(() => this.ngxSignalTranslate.translate('Books')),
    filterAlbum: computed(() => this.ngxSignalTranslate.translate('Music')),
    filterUnwatched: computed(() => this.ngxSignalTranslate.translate('Unwatched')),
    filterFavorite: computed(() => this.ngxSignalTranslate.translate('Favorites')),
    filterCompleted: computed(() => this.ngxSignalTranslate.translate('Completed')),
    filterUncompleted: computed(() => this.ngxSignalTranslate.translate('Uncompleted')),
    filterSharedMine: computed(() => this.ngxSignalTranslate.translate('FilterSharedMine')),
    filterSharedOnly: computed(() => this.ngxSignalTranslate.translate('FilterSharedOnly')),
  };
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly config = this.actionButtons.config;
  protected readonly showFloatButtons = signal(false);
  protected readonly actionButtonsVisible = computed(() => this.config().showActions && this.showFloatButtons());
  protected readonly rowFilterActions = computed(() =>
    this.config().filterActions.filter(
      (filter) => filter === 'movie' || filter === 'series' || filter === 'book' || filter === 'album'
    )
  );
  protected readonly stackedFilterActions = computed(() =>
    this.config().filterActions.filter(
      (filter) => filter !== 'movie' && filter !== 'series' && filter !== 'book' && filter !== 'album'
    )
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

    const transferFocus = this.host.nativeElement.contains(this.host.nativeElement.ownerDocument.activeElement);
    this.showFloatButtons.set(true);
    this.actionButtons.showFunctions();
    if (transferFocus) {
      this.changeDetector.detectChanges();
      this.host.nativeElement
        .querySelector<HTMLElement>(
          '.float-buttons-container:not([inert]) button:not(:disabled), [data-test-id="hide-functions"]'
        )
        ?.focus();
    }
  }

  protected onHideFunctions(): void {
    const restoreFocus = this.host.nativeElement.contains(this.host.nativeElement.ownerDocument.activeElement);
    this.host.nativeElement.querySelector('.float-buttons-container:not([inert])')?.setAttribute('inert', '');
    this.showFloatButtons.set(false);
    if (restoreFocus) {
      this.changeDetector.detectChanges();
      this.host.nativeElement.querySelector<HTMLElement>('[data-test-id="show-functions"]')?.focus();
    }
  }

  protected onRandomPick(): void {
    this.actionButtons.randomPick();
    this.showFloatButtons.set(false);
  }

  protected onToggleOrderBy(): void {
    this.actionButtons.toggleOrderBy();
    this.onHideFunctions();
  }

  protected onToggleOrderDirection(): void {
    this.actionButtons.toggleOrderDirection();
    this.onHideFunctions();
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
    this.onHideFunctions();
  }

  protected onAddNew(event?: Event): void {
    this.actionButtons.addNew(
      this.actionButtonsVisible()
        ? () => {
            if (
              !this.host.nativeElement.querySelector('[data-test-id="show-functions"]') &&
              !this.actionButtonsVisible()
            ) {
              this.changeDetector.detectChanges();
            }
            return this.host.nativeElement.querySelector<HTMLElement>('[data-test-id="show-functions"]');
          }
        : undefined
    );
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.closest('.float-buttons-container')?.setAttribute('inert', '');
    }
    this.showFloatButtons.set(false);
  }

  protected filterActionLabel(filter: FloatActionFilter): string {
    const labels: Record<FloatActionFilter, string> = {
      movie: this.translations.filterMovie(),
      series: this.translations.filterSeries(),
      book: this.translations.filterBook(),
      album: this.translations.filterAlbum(),
      unwatched: this.translations.filterUnwatched(),
      favorite: this.translations.filterFavorite(),
      completed: this.translations.filterCompleted(),
      uncompleted: this.translations.filterUncompleted(),
      sharedMine: this.translations.filterSharedMine(),
      sharedOnly: this.translations.filterSharedOnly(),
    };

    return labels[filter];
  }

  protected filterActionIcon(filter: FloatActionFilter): string {
    const icons: Record<FloatActionFilter, string> = {
      movie: 'movie',
      series: 'live_tv',
      book: 'menu_book',
      album: 'album',
      unwatched: 'visibility_off',
      favorite: 'star',
      completed: 'check_circle',
      uncompleted: 'radio_button_unchecked',
      sharedMine: 'person',
      sharedOnly: 'group',
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
