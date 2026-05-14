import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNWATCHED_TAG, WATCH_LATER_TAG } from '@shared/constants/tags-const';
import { CollectionItemFiltersApiModel, CollectionItemsApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import {
  asyncScheduler,
  catchError,
  debounceTime,
  EMPTY,
  fromEvent,
  Observable,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { sharesStateToken } from '../../shares/shares-store';
import { CollectionItemModel } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { ItemDialog } from '../item-dialog/item-dialog';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { FloatButtons } from './float-buttons/float-buttons';
import { COLLECTION_LIST_PAGE_SIZE, COLLECTION_SEARCH_DEBOUNCE_MS } from './list-const';
import { ListItemSkeleton } from './list-item-skeleton/list-item-skeleton';
import { ListItem } from './list-item/list-item';

@Component({
  selector: 'ct-list',
  imports: [ListItem, ListItemSkeleton, FloatButtons],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List {
  private readonly ngxSignalTranslate = inject(NgxSignalTranslateService);
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aiSearch = inject(AiSearchService);
  private readonly sharesState = inject(sharesStateToken);
  protected readonly debouncedSearchText = signal('');
  private readonly routeSearchVersion = signal(0);
  private lastRouteSearchText: string | null = null;
  private readonly aiSearchSendTrigger = computed(() => ({
    promptText: this.collectionState.state.aiSearchPromptText(),
    version: this.collectionState.state.aiSearchSendVersion(),
  }));
  private readonly aiSearchMatchedIds = toSignal(
    toObservable(this.aiSearchSendTrigger).pipe(
      debounceTime(500),
      switchMap(({ promptText }) => this.aiSearch.getMatchedIds(promptText)),
      startWith(null)
    ),
    { initialValue: null }
  );
  protected readonly translations = {
    collection: computed(() => this.ngxSignalTranslate.translate('Collection')),
    messageEmptyCollection: computed(() => this.ngxSignalTranslate.translate('Message.EmptyCollection')),
    messageAddFirstCollectionItem: computed(() => this.ngxSignalTranslate.translate('Message.AddFirstCollectionItem')),
    messageEmptySearch: computed(() => this.ngxSignalTranslate.translate('Message.EmptySearch')),
  };
  protected readonly visibleCollection = signal<CollectionItemModel[]>([]);
  protected readonly collectionLength = signal(0);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly hasMore = computed(() => this.visibleCollection().length < this.collectionLength());
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly scrollToTopAvailable = signal(false);
  protected readonly isWatchLaterPrefiltered = computed(() => this.routeSearchText() === WATCH_LATER_TAG);
  public readonly hideFloatActions = input(false);
  public readonly routeSearchText = input('');

  constructor() {
    this.loadShares();

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
      const searchText = this.debouncedSearchText();
      this.aiSearchMatchedIds();
      this.aiSearch.useAiSearch();
      this.collectionState.state.forceStandardSearch();
      this.collectionState.state.aiSearchPromptText();
      this.mainCollectionState.state.reloadTrigger();
      untracked(() => this.loadItems(true, searchText));
    });

    effect(() => {
      this.debouncedSearchText();
      this.onResetScrollPosition();
    });
  }

  protected onRandomPick(): void {
    this.api
      .getRandomItem()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => this.portal.open(ItemDialog, { collectionItem: item }));
  }

  protected onAddNew(): void {
    this.portal.open(NewItemDialog, { watchLater: this.isWatchLaterPrefiltered() });
  }

  protected onScroll(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    this.scrollToTopAvailable.set(element.scrollTop !== 0);

    if (!this.hasMore() || this.apiLoadNetworkStatus() === 'pending') return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 200) {
      this.loadItems(false, this.debouncedSearchText());
    }
  }

  protected onToggleAiSearch(): void {
    this.aiSearch.useAiSearch.set(!this.aiSearch.useAiSearch());
    this.collectionState.setState('searchText', '');
  }

  protected onShowFunctions(): void {
    if (this.isWatchLaterPrefiltered()) return;

    this.aiSearch
      .checkAiAvailable()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => EMPTY)
      )
      .subscribe();
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
          this.scrollToTopAvailable.set(false);
          subscription.unsubscribe();
        });
    }
  }

  private loadItems(reset: boolean, searchText = this.collectionState.state.searchText()): void {
    this.getItemsRequest(reset, searchText)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.applyItemsResponse(response, reset));
  }

  private getItemsRequest(reset: boolean, searchText: string): Observable<CollectionItemsApiResponseModel> {
    const offset = reset ? 0 : this.visibleCollection().length;
    const limit = COLLECTION_LIST_PAGE_SIZE;
    const aiIds = this.aiSearchMatchedIds();
    const promptText = this.collectionState.state.aiSearchPromptText().trim();
    const useAiSearch = this.aiSearch.useAiSearch() && !this.collectionState.state.forceStandardSearch();

    if (useAiSearch && promptText && aiIds === null) {
      return EMPTY;
    }

    if (reset) {
      this.visibleCollection.set([]);
    }

    this.apiState.setState('loadNetworkStatus', 'pending');

    const request = useAiSearch
      ? promptText
        ? this.api.getMatchedItems({ imdbIds: aiIds as string[], offset, limit })
        : this.api.searchItems({}, offset, limit)
      : this.api.searchItems(this.buildFilters(searchText), offset, limit);

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

  private buildFilters(searchText: string): CollectionItemFiltersApiModel {
    const search = searchText.trim();
    if (search === VIRTUAL_UNWATCHED_TAG) return { watched: false };
    if (search.startsWith('#')) return { tags: [search], tagMode: 'all' };
    return search ? { search } : {};
  }

  private loadShares(): void {
    if (this.sharesState.state.loaded()) return;

    this.api
      .getShares()
      .pipe(
        tap((result) => {
          this.sharesState.setState('loaded', true);
          this.sharesState.setState('userShareCode', result.userShareCode);
          this.sharesState.setState('outgoing', result.outgoing);
          this.sharesState.setState('incoming', result.incoming);
        }),
        catchError(() => {
          this.sharesState.setState('loaded', true);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
