import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { collectionStateToken } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { FloatButtons } from '@client/collection/list/float-buttons/float-buttons';
import { InfiniteScrollService } from '@client/collection/list/infinite-scroll/infinite-scroll-service';
import { ListItemSkeleton } from '@client/collection/list/list-item-skeleton/list-item-skeleton';
import { ListItem } from '@client/collection/list/list-item/list-item';
import { matchesSearch } from '@client/collection/list/utils/matches-search-util';
import { NewItemDialog } from '@client/collection/new-item-dialog/new-item-dialog';
import { ClaudeSearchService } from '@client/collection/search/claude-search-service';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { affordableFuzzySearch } from '@shared/utils/fuzzy-search-util';
import { randomInt } from '@shared/utils/random-int-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { debounceTime, startWith, switchMap } from 'rxjs';

@Component({
  selector: 'ct-list',
  imports: [NgxSignalTranslatePipe, ListItem, ListItemSkeleton, FloatButtons],
  templateUrl: './list.html',
  styleUrl: './list.css',
  providers: [InfiniteScrollService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly portal = inject(PortalService);
  private readonly infiniteScroll = inject(InfiniteScrollService);
  private readonly claudeSearch = inject(ClaudeSearchService);
  private readonly debouncedSearchText = toSignal(
    toObservable(this.collectionState.state.searchText).pipe(startWith(''), debounceTime(100))
  );
  private readonly claudeAiSendTrigger = computed(() => ({
    promptText: this.collectionState.state.claudeAiPromptText(),
    version: this.collectionState.state.claudeAiSendVersion(),
  }));
  private readonly claudeAiMatchedIds = toSignal(
    toObservable(this.claudeAiSendTrigger).pipe(
      debounceTime(500),
      switchMap(({ promptText }) => this.claudeSearch.getMatchedIds(promptText)),
      startWith(null)
    ),
    { initialValue: null }
  );
  protected readonly filteredCollection = computed(() => {
    const aiIds = this.claudeAiMatchedIds();

    if (this.claudeSearch.useClaudeAi()) {
      if (this.collectionState.state.claudeAiPromptText().trim() === '' || aiIds === null) {
        return this.mainCollectionState.state.collection();
      }

      return this.mainCollectionState.state.collection().filter((item) => aiIds.includes(item.IMDbId));
    }

    const forceStandardSearch = untracked(() => this.collectionState.state.forceStandardSearch());
    const searchText = this.debouncedSearchText() || '';
    const useFuzzySearch = !forceStandardSearch && affordableFuzzySearch(searchText.toLowerCase());

    return this.mainCollectionState.state
      .collection()
      .filter((item) => matchesSearch(item, searchText, useFuzzySearch));
  });
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly collectionLength = computed(() => this.mainCollectionState.state.collection().length);
  protected readonly visibleCollection = this.infiniteScroll.visibleItems;
  protected readonly hasMore = this.infiniteScroll.hasMore;
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly scrollToTopAvailable = signal(false);

  constructor() {
    this.infiniteScroll.setCollectionSource(this.filteredCollection);

    effect(() => {
      this.collectionState.state.searchText();
      this.onResetScrollPosition();
    });
  }

  protected onRandomPick(): void {
    const filteredCollection = this.filteredCollection();
    const randomIndex = randomInt(0, filteredCollection.length - 1);

    this.portal.open(ItemDialog, { collectionItem: filteredCollection[randomIndex] });
  }

  protected onAddNew(): void {
    this.portal.open(NewItemDialog);
  }

  protected onScroll(): void {
    const element = this.scrollContainer()?.nativeElement;
    if (!element) return;

    this.scrollToTopAvailable.set(element.scrollTop !== 0);

    if (!this.infiniteScroll.hasMore()) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 200) {
      this.infiniteScroll.loadMore();
    }
  }

  protected onToggleClaudeAi(): void {
    this.claudeSearch.useClaudeAi.set(!this.claudeSearch.useClaudeAi());
    this.collectionState.setState('searchText', '');
  }

  protected onResetScrollPosition(): void {
    this.scrollToTopAvailable.set(false);
    this.infiniteScroll.reset();
    this.scrollContainer()?.nativeElement.scrollTo({
      top: 0,
      left: 1000,
      behavior: 'smooth',
    });
  }
}
