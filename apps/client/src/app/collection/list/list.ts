import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_COLLECTION_LIST_ORDER_PREFERENCES } from '@shared/constants/storage-const';
import {
  CollectionItemOrderBy,
  CollectionItemOrderDirection,
  CollectionItemsApiResponseModel,
  CollectionListTypeModel,
} from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { asyncScheduler, catchError, debounceTime, EMPTY, fromEvent, Observable } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { SharesLoaderService } from '../../shares/shares-loader-service';
import { CollectionItemModel, CollectionListDataSource, CollectionListOrderPreference } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { FloatActionButtons } from '../float-action-buttons/float-action-buttons';
import { FloatActionButtonsService } from '../float-action-buttons/float-action-buttons-service';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { COLLECTION_LIST_PAGE_SIZE, COLLECTION_SEARCH_DEBOUNCE_MS } from './list-const';
import { ListItemSkeleton } from './list-item-skeleton/list-item-skeleton';
import { ListItem } from './list-item/list-item';

@Component({
  selector: 'ct-list',
  imports: [ListItem, ListItemSkeleton],
  templateUrl: './list.html',
  styleUrl: './list.css',
  providers: [SharesLoaderService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List implements OnDestroy {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sharesLoader = inject(SharesLoaderService);
  private readonly floatActions = inject(FloatActionsService);
  private readonly actionButtons = inject(FloatActionButtonsService);
  private readonly webstorage = inject(WebstorageService);
  private readonly aiSearch = inject(AiSearchService, { optional: true });
  protected readonly debouncedSearchText = signal('');
  private readonly routeSearchVersion = signal(0);
  private lastRouteSearchText: string | null = null;
  protected readonly translations = {
    collection: computed(() => this.ngxSignalTranslate.translate('Collection')),
    messageEmptyCollection: computed(() => this.ngxSignalTranslate.translate('Message.EmptyCollection')),
    messageAddFirstCollectionItem: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstCollectionItem')),
    messageEmptySearch: computed(() => this.ngxSignalTranslate.translate('Message.EmptySearch')),
  };
  protected readonly visibleCollection = signal<CollectionItemModel[]>([]);
  protected readonly collectionLength = signal(0);
  protected readonly orderBy = signal<CollectionItemOrderBy>('createdAt');
  protected readonly orderDirection = signal<CollectionItemOrderDirection>('desc');
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly hasMore = computed(() => this.visibleCollection().length < this.collectionLength());
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly scrollToTopAvailable = signal(false);
  protected readonly isInternalCollectionPrefiltered = computed(() => this.listType() !== 'library');
  public readonly hideFloatActions = input(false);
  public readonly showAddButton = input(true);
  public readonly showAiSearchButton = input(true);
  public readonly showRandomPickButton = input(true);
  public readonly orderStorageKey = input('');
  public readonly routeSearchText = input('');
  public readonly listType = input<CollectionListTypeModel>('library');
  public readonly dataSource = input.required<CollectionListDataSource>();
  public readonly randomPick = output<void>();
  public readonly toggleAiSearch = output<void>();
  public readonly showFunctions = output<void>();

  constructor() {
    this.sharesLoader.load(this.destroyRef);
    this.actionButtons.setCallbacks({
      addNew: () => this.onAddNew(),
      randomPick: () => this.onRandomPick(),
      toggleAiSearch: () => this.onToggleAiSearch(),
      toggleOrderBy: () => this.onToggleOrderBy(),
      toggleOrderDirection: () => this.onToggleOrderDirection(),
      showFunctions: () => this.onShowFunctions(),
    });
    this.floatActions.setScrollToTopCallback(() => this.onResetScrollPosition());
    this.floatActions.setActionsComponent(FloatActionButtons);

    effect((onCleanup) => {
      const searchText = this.collectionState.state.searchText();
      const routeSearchVersion = untracked(() => this.routeSearchVersion());
      const subscription = asyncScheduler.schedule(() => {
        if (this.routeSearchVersion() === routeSearchVersion) {
          this.debouncedSearchText.set(searchText);
        }
      }, COLLECTION_SEARCH_DEBOUNCE_MS);

      onCleanup(() => subscription.unsubscribe());
    });

    effect(() => {
      const routeSearchText = this.routeSearchText();
      untracked(() => {
        if (this.lastRouteSearchText === null) {
          this.lastRouteSearchText = routeSearchText;
          if (routeSearchText) {
            this.routeSearchVersion.update((version) => version + 1);
          }
        } else if (this.lastRouteSearchText !== routeSearchText) {
          this.lastRouteSearchText = routeSearchText;
          this.routeSearchVersion.update((version) => version + 1);
        }

        if (this.debouncedSearchText() !== routeSearchText) {
          this.debouncedSearchText.set(routeSearchText);
        }
      });
    });

    effect(() => {
      const storageKey = this.getOrderStorageKey();
      const preference = this.readOrderPreference(storageKey);
      untracked(() => {
        this.orderBy.set(preference.orderBy);
        this.orderDirection.set(preference.orderDirection);
      });
    });

    effect(() => {
      const searchText = this.debouncedSearchText();
      const orderBy = this.orderBy();
      const orderDirection = this.orderDirection();
      this.mainCollectionState.state.reloadTrigger();
      untracked(() => this.loadItems(true, searchText, orderBy, orderDirection));
    });

    effect(() => {
      this.debouncedSearchText();
      this.orderBy();
      this.orderDirection();
      this.onResetScrollPosition();
    });

    effect(() => {
      this.writeOrderPreference(this.getOrderStorageKey(), {
        orderBy: this.orderBy(),
        orderDirection: this.orderDirection(),
      });
    });

    effect(() => {
      const showActions = !this.hideFloatActions();
      this.floatActions.updateConfig({
        scrollToTopAvailable: this.scrollToTopAvailable(),
        actionsAvailable: showActions,
      });
      this.actionButtons.updateConfig({
        collectionLength: this.collectionLength(),
        showActions,
        showAddButton: this.showAddButton(),
        showAiSearchButton: this.showAiSearchButton() && !this.isInternalCollectionPrefiltered(),
        showRandomPickButton: this.showRandomPickButton() && !this.isInternalCollectionPrefiltered(),
        showOrderButtons: showActions,
        useAiSearch: this.aiSearch?.useAiSearch() ?? false,
        orderBy: this.orderBy(),
        orderDirection: this.orderDirection(),
      });
    });
  }

  public ngOnDestroy(): void {
    this.floatActions.resetActions();
    this.actionButtons.reset();
  }

  protected onRandomPick(): void {
    this.randomPick.emit();
  }

  protected onAddNew(): void {
    this.portal.open(NewItemDialog, {
      watchLater: this.listType() === 'watch-later',
      wishlist: this.listType() === 'wishlist',
      seriesTracker: this.listType() === 'series-tracker',
    });
  }

  protected onScroll(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    this.scrollToTopAvailable.set(element.scrollTop !== 0);

    if (!this.hasMore() || this.apiLoadNetworkStatus() === 'pending') return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 200) {
      this.loadItems(false, this.debouncedSearchText(), this.orderBy(), this.orderDirection());
    }
  }

  protected onToggleAiSearch(): void {
    this.toggleAiSearch.emit();
  }

  protected onToggleOrderBy(): void {
    this.orderBy.update((orderBy) => (orderBy === 'createdAt' ? 'alphabet' : 'createdAt'));
  }

  protected onToggleOrderDirection(): void {
    this.orderDirection.update((orderDirection) => (orderDirection === 'asc' ? 'desc' : 'asc'));
  }

  protected onShowFunctions(): void {
    if (this.isInternalCollectionPrefiltered()) return;
    this.showFunctions.emit();
  }

  protected onResetScrollPosition(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    element.scrollTo({
      top: 0,
      left: 1000,
      behavior: 'smooth',
    });
    if (typeof element.addEventListener === 'function') {
      const subscription = fromEvent(element, 'scroll')
        .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.scrollToTopAvailable.set(element.scrollTop !== 0);
          subscription.unsubscribe();
        });
    }
  }

  private loadItems(
    reset: boolean,
    searchText = this.collectionState.state.searchText(),
    orderBy = this.orderBy(),
    orderDirection = this.orderDirection()
  ): void {
    this.getItemsRequest(reset, searchText, orderBy, orderDirection)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.applyItemsResponse(response, reset));
  }

  private getItemsRequest(
    reset: boolean,
    searchText: string,
    orderBy: CollectionItemOrderBy,
    orderDirection: CollectionItemOrderDirection
  ): Observable<CollectionItemsApiResponseModel> {
    const offset = reset ? 0 : this.visibleCollection().length;
    const limit = COLLECTION_LIST_PAGE_SIZE;
    if (reset) {
      this.visibleCollection.set([]);
    }

    this.apiState.setState('loadNetworkStatus', 'pending');

    const request = this.dataSource()({ reset, offset, limit, searchText, orderBy, orderDirection });

    return request.pipe(
      catchError(() => {
        this.apiState.setState('loadNetworkStatus', 'error');
        return EMPTY;
      })
    );
  }

  private applyItemsResponse(response: CollectionItemsApiResponseModel, reset: boolean): void {
    this.visibleCollection.set(reset ? response.items : [...this.visibleCollection(), ...response.items]);
    this.collectionLength.set(response.total);
    this.apiState.setState('loadNetworkStatus', 'finished');
  }

  private getOrderStorageKey(): string {
    return this.orderStorageKey() || this.listType();
  }

  private readOrderPreference(storageKey: string): CollectionListOrderPreference {
    const preferences = this.readOrderPreferences();
    return this.normalizeOrderPreference(preferences[storageKey]);
  }

  private writeOrderPreference(storageKey: string, preference: CollectionListOrderPreference): void {
    const preferences = this.readOrderPreferences();
    preferences[storageKey] = preference;
    this.webstorage.setItem(STORAGE_COLLECTION_LIST_ORDER_PREFERENCES, JSON.stringify(preferences));
  }

  private readOrderPreferences(): Record<string, Partial<CollectionListOrderPreference> | undefined> {
    const storedValue = this.webstorage.getItem(STORAGE_COLLECTION_LIST_ORDER_PREFERENCES, 'local');
    if (!storedValue) return {};

    try {
      const parsedValue = JSON.parse(storedValue) as unknown;
      return parsedValue && typeof parsedValue === 'object'
        ? (parsedValue as Record<string, Partial<CollectionListOrderPreference> | undefined>)
        : {};
    } catch {
      return {};
    }
  }

  private normalizeOrderPreference(
    preference: Partial<CollectionListOrderPreference> | undefined
  ): CollectionListOrderPreference {
    return {
      orderBy: preference?.orderBy === 'alphabet' ? 'alphabet' : 'createdAt',
      orderDirection: preference?.orderDirection === 'asc' ? 'asc' : 'desc',
    };
  }
}
