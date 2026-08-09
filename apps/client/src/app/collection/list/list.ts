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
import { Router } from '@angular/router';
import { asyncScheduler, catchError, debounceTime, EMPTY, fromEvent, Observable, Subscription } from 'rxjs';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { mainStateToken } from '../../main/main-store';
import { SharesLoaderService } from '../../shares/shares-loader-service';
import { sharesStateToken } from '../../shares/shares-store';
import { CollectionItemModel, CollectionListDataSource, CollectionListOrderPreference } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { FloatActionButtons } from '../float-action-buttons/float-action-buttons';
import { FloatActionFilter } from '../float-action-buttons/float-action-buttons-model';
import { FloatActionButtonsService } from '../float-action-buttons/float-action-buttons-service';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { COLLECTION_LIST_PAGE_SIZE, COLLECTION_SEARCH_DEBOUNCE_MS, FLOAT_ACTION_SCROLLING_IDLE_MS } from './list-const';
import { getAllowedAddContentTypes } from './list-util';
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
  private readonly sharesState = inject(sharesStateToken);
  private readonly floatActions = inject(FloatActionsService);
  private readonly actionButtons = inject(FloatActionButtonsService);
  private readonly webstorage = inject(WebstorageService);
  private readonly router = inject(Router);
  private readonly mainState = inject(mainStateToken);
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
  protected readonly scrolling = signal(false);
  protected readonly isInternalCollectionPrefiltered = computed(() => this.listType() !== 'library');
  public readonly hideFloatActions = input(false);
  public readonly showAddButton = input(true);
  public readonly showRandomPickButton = input(true);
  public readonly orderStorageKey = input('');
  public readonly routeSearchText = input('');
  public readonly routeFilterKey = input('');
  public readonly listType = input<CollectionListTypeModel>('library');
  public readonly emptyIcon = input('local_library');
  public readonly dataSource = input.required<CollectionListDataSource>();
  public readonly randomPick = output<void>();
  public readonly showFunctions = output<void>();
  private scrollingIdleSubscription: Subscription | null = null;

  constructor() {
    this.sharesLoader.load(this.destroyRef);
    this.actionButtons.setCallbacks({
      addNew: () => this.onAddNew(),
      randomPick: () => this.onRandomPick(),
      toggleOrderBy: () => this.onToggleOrderBy(),
      toggleOrderDirection: () => this.onToggleOrderDirection(),
      applyFilter: (filter) => this.onApplyFilter(filter),
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
      this.routeFilterKey();
      this.mainCollectionState.state.reloadTrigger();
      untracked(() => this.loadItems(true, searchText, orderBy, orderDirection));
    });

    effect(() => {
      this.debouncedSearchText();
      this.orderBy();
      this.orderDirection();
      this.routeFilterKey();
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
        scrolling: this.scrolling(),
      });
      this.actionButtons.updateConfig({
        collectionLength: this.collectionLength(),
        showActions: showActions,
        showAddButton: this.showAddButton(),
        showRandomPickButton: this.showRandomPickButton() && !this.isInternalCollectionPrefiltered(),
        showOrderButtons: showActions,
        filterActions: this.getFilterActions(),
        activeFilterActions: this.getActiveFilterActions(),
        orderBy: this.orderBy(),
        orderDirection: this.orderDirection(),
      });
    });
  }

  public ngOnDestroy(): void {
    this.scrollingIdleSubscription?.unsubscribe();
    this.floatActions.resetActions();
    this.actionButtons.reset();
  }

  protected onRandomPick(): void {
    this.randomPick.emit();
  }

  protected onAddNew(): void {
    const listType = this.listType();
    const activeFilters = this.getActiveFilterActions();
    const lockedType =
      activeFilters.includes('book') || listType === 'books'
        ? ('book' as const)
        : activeFilters.includes('movie')
          ? ('movie' as const)
          : activeFilters.includes('series')
            ? ('series' as const)
            : undefined;
    const booksEnabled = this.mainState.state.collectionFeaturePreferences().books;
    this.portal.open(NewItemDialog, {
      upNext: listType === 'up-next',
      wishlist: listType === 'wishlist',
      tracking: listType === 'tracking',
      books: lockedType === 'book',
      allowedContentTypes: getAllowedAddContentTypes(listType, lockedType, booksEnabled),
    });
  }

  protected onScroll(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    this.scrollToTopAvailable.set(element.scrollTop !== 0);
    this.markScrolling();

    if (!this.hasMore() || this.apiLoadNetworkStatus() === 'pending') return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 200) {
      this.loadItems(false, this.debouncedSearchText(), this.orderBy(), this.orderDirection());
    }
  }

  protected onToggleOrderBy(): void {
    this.orderBy.update((orderBy) => (orderBy === 'createdAt' ? 'alphabet' : 'createdAt'));
  }

  protected onToggleOrderDirection(): void {
    this.orderDirection.update((orderDirection) => (orderDirection === 'asc' ? 'desc' : 'asc'));
  }

  protected onApplyFilter(filter: FloatActionFilter): void {
    const active = this.getActiveFilterActions().includes(filter);

    const queryParams: Record<string, string | null> =
      filter === 'movie' || filter === 'series' || filter === 'book'
        ? { type: active ? null : filter }
        : filter === 'unwatched'
          ? { watched: active ? null : 'false' }
          : filter === 'favorite'
            ? { favorite: active ? null : 'true' }
            : filter === 'sharedMine' || filter === 'sharedOnly'
              ? {
                  shared: active ? null : filter === 'sharedMine' ? 'mine' : 'shared',
                }
              : { completed: active ? null : filter === 'completed' ? 'true' : 'false' };

    void this.router.navigate([], { queryParams, queryParamsHandling: 'merge' });
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

  private markScrolling(): void {
    this.scrolling.set(true);
    this.scrollingIdleSubscription?.unsubscribe();
    this.scrollingIdleSubscription = asyncScheduler.schedule(() => {
      this.scrolling.set(false);
      this.scrollingIdleSubscription = null;
    }, FLOAT_ACTION_SCROLLING_IDLE_MS);
  }

  private applyItemsResponse(response: CollectionItemsApiResponseModel, reset: boolean): void {
    this.visibleCollection.set(reset ? response.items : [...this.visibleCollection(), ...response.items]);
    this.collectionLength.set(response.total);
    this.apiState.setState('loadNetworkStatus', 'finished');
  }

  private getOrderStorageKey(): string {
    return this.orderStorageKey() || this.listType();
  }

  private getFilterActions(): FloatActionFilter[] {
    if (this.hideFloatActions()) return [];

    const sharedFilters = this.hasIncomingReadableShares() ? (['sharedMine', 'sharedOnly'] as const) : [];

    switch (this.listType()) {
      case 'library': {
        // Media scope is the always-visible chips; float keeps status filters only.
        const active = this.getActiveFilterActions();
        if (active.includes('book')) return ['favorite', ...sharedFilters];
        return ['unwatched', 'favorite', ...sharedFilters];
      }
      case 'up-next':
      case 'wishlist':
        // Media scope uses chips on these hubs.
        return [...sharedFilters];
      case 'tracking':
        return ['completed', 'uncompleted', ...sharedFilters];
      case 'books':
        return ['favorite', ...sharedFilters];
    }
  }

  private hasIncomingReadableShares(): boolean {
    const listType = this.listType();
    return this.sharesState.state.incoming().some((share) =>
      share.grants.some((grant) => {
        if (!grant.canRead) return false;
        if (listType === 'library') return grant.listType === 'library' || grant.listType === 'books';
        return grant.listType === listType;
      })
    );
  }

  private getActiveFilterActions(): FloatActionFilter[] {
    const routeFilterKey = this.routeFilterKey();
    if (!routeFilterKey) return this.listType() === 'books' ? ['book'] : [];

    try {
      const filters = JSON.parse(routeFilterKey) as {
        type?: unknown;
        favorite?: unknown;
        watched?: unknown;
        completed?: unknown;
        shared?: unknown;
      };
      const activeFilters: FloatActionFilter[] = [
        ...(filters.type === 'movie' ? (['movie'] as const) : []),
        ...(filters.type === 'series' ? (['series'] as const) : []),
        ...(filters.type === 'book' ? (['book'] as const) : []),
        ...(filters.watched === false ? (['unwatched'] as const) : []),
        ...(filters.favorite === true ? (['favorite'] as const) : []),
        ...(filters.completed === true ? (['completed'] as const) : []),
        ...(filters.completed === false ? (['uncompleted'] as const) : []),
        ...(filters.shared === 'mine' ? (['sharedMine'] as const) : []),
        ...(filters.shared === 'shared' ? (['sharedOnly'] as const) : []),
      ];

      return this.listType() === 'books'
        ? ['book', ...activeFilters.filter((filter) => filter !== 'movie' && filter !== 'series' && filter !== 'book')]
        : activeFilters;
    } catch {
      return this.listType() === 'books' ? ['book'] : [];
    }
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
