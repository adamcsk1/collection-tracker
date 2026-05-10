import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '@services/api/api-service';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNWATCHED_TAG } from '@shared/constants/tags-const';
import { CollectionItemFiltersApiModel } from '@shared/models/api-model';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { catchError, debounceTime, EMPTY, fromEvent, startWith, switchMap } from 'rxjs';
import { mainCollectionStateToken } from '../../main/main-collection-store';
import { CollectionItemModel } from '../collection-model';
import { collectionStateToken } from '../collection-store';
import { ItemDialog } from '../item-dialog/item-dialog';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { FloatButtons } from './float-buttons/float-buttons';
import { COLLECTION_LIST_PAGE_SIZE } from './list-const';
import { ListItemSkeleton } from './list-item-skeleton/list-item-skeleton';
import { ListItem } from './list-item/list-item';

@Component({
  selector: 'ct-list',
  imports: [NgxSignalTranslatePipe, ListItem, ListItemSkeleton, FloatButtons],
  templateUrl: './list.html',
  styleUrl: './list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly api = inject(ApiService);
  private readonly apiState = inject(apiStateToken);
  private readonly portal = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aiSearch = inject(AiSearchService);
  private requestVersion = 0;
  private readonly debouncedSearchText = toSignal(
    toObservable(this.collectionState.state.searchText).pipe(debounceTime(100)),
    { initialValue: '' }
  );
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
  protected readonly visibleCollection = signal<CollectionItemModel[]>([]);
  protected readonly collectionLength = signal(0);
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly hasMore = computed(() => this.visibleCollection().length < this.collectionLength());
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly scrollToTopAvailable = signal(false);

  constructor() {
    effect(() => {
      this.debouncedSearchText();
      this.aiSearchMatchedIds();
      this.aiSearch.useAiSearch();
      this.collectionState.state.aiSearchPromptText();
      this.mainCollectionState.state.reloadTrigger();
      this.loadItems(true);
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
    this.portal.open(NewItemDialog);
  }

  protected onScroll(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    this.scrollToTopAvailable.set(element.scrollTop !== 0);

    if (!this.hasMore() || this.apiLoadNetworkStatus() === 'pending') return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 200) {
      this.loadItems(false);
    }
  }

  protected onToggleAiSearch(): void {
    this.aiSearch.useAiSearch.set(!this.aiSearch.useAiSearch());
    this.collectionState.setState('searchText', '');
  }

  protected onShowFunctions(): void {
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

  private loadItems(reset: boolean): void {
    const requestVersion = ++this.requestVersion;
    const offset = reset ? 0 : this.visibleCollection().length;
    const limit = COLLECTION_LIST_PAGE_SIZE;
    const aiIds = this.aiSearchMatchedIds();
    const promptText = this.collectionState.state.aiSearchPromptText().trim();

    if (this.aiSearch.useAiSearch() && promptText && aiIds === null) {
      return;
    }

    if (reset) {
      this.visibleCollection.set([]);
    }

    this.apiState.setState('loadNetworkStatus', 'pending');

    const request = this.aiSearch.useAiSearch()
      ? promptText
        ? this.api.getMatchedItems({ imdbIds: aiIds as string[], offset, limit })
        : this.api.searchItems({}, offset, limit)
      : this.api.searchItems(this.buildFilters(), offset, limit);

    request
      .pipe(
        catchError(() => {
          if (requestVersion === this.requestVersion) this.apiState.setState('loadNetworkStatus', 'error');
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (requestVersion !== this.requestVersion) return;

        this.visibleCollection.set(reset ? response.items : [...this.visibleCollection(), ...response.items]);
        this.collectionLength.set(response.total);
        this.apiState.setState('loadNetworkStatus', 'finished');
      });
  }

  private buildFilters(): CollectionItemFiltersApiModel {
    const search = this.collectionState.state.searchText().trim();
    if (search === VIRTUAL_UNWATCHED_TAG) return { watched: false };
    if (search.startsWith('#')) return { tags: [search], tagMode: 'all' };
    return search ? { search } : {};
  }
}
