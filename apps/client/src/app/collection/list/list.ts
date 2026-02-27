import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { collectionStateToken } from '@client/collection/collection-store';
import { ItemDialog } from '@client/collection/item-dialog/item-dialog';
import { ListItemSkeleton } from '@client/collection/list/list-item-skeleton/list-item-skeleton';
import { ListItem } from '@client/collection/list/list-item/list-item';
import { PaginationService } from '@client/collection/list/pagination/pagination-service';
import { NewItemDialog } from '@client/collection/new-item-dialog/new-item-dialog';
import { mainCollectionStateToken } from '@client/main/main-collection-store';
import { mainStateToken } from '@client/main/main-store';
import { apiStateToken } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { EXACT_IMDB_ID_REGEXP } from '@shared/regexps/imdb-id-regexp';
import { affordableFuzzySearch, fuzzySearch } from '@shared/utils/fuzzy-search-util';
import { randomInt } from '@shared/utils/random-int-util';
import { NgxSignalTranslatePipe } from 'ngx-signal-translate';
import { debounceTime, startWith } from 'rxjs';

@Component({
  selector: 'ct-list',
  imports: [NgxSignalTranslatePipe, ListItem, ListItemSkeleton],
  templateUrl: './list.html',
  styleUrl: './list.css',
  providers: [PaginationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class List {
  private readonly mainCollectionState = inject(mainCollectionStateToken);
  private readonly mainState = inject(mainStateToken);
  private readonly apiState = inject(apiStateToken);
  private readonly collectionState = inject(collectionStateToken);
  private readonly portal = inject(PortalService);
  private readonly pagination = inject(PaginationService);
  private readonly debouncedSearchText = toSignal(
    toObservable(this.collectionState.state.searchText).pipe(startWith(''), debounceTime(100))
  );
  protected readonly filteredCollection = computed(() => {
    const searchText = this.debouncedSearchText() || '';
    const lowerCasedSearchText = searchText.toLowerCase();
    this.resetScrollPosition();
    const isExactIMDbId = searchText.match(EXACT_IMDB_ID_REGEXP) !== null;
    const isTagSearchQuery = searchText.startsWith('#');

    return this.mainCollectionState.state.collection().filter((collectionItem) => {
      if (isExactIMDbId) return collectionItem.IMDbId === searchText;
      else if (isTagSearchQuery) return collectionItem.tags.includes(searchText);
      else if (this.mainState.state.searchMode() === 'fuzzy' && affordableFuzzySearch(lowerCasedSearchText)) {
        return (fuzzySearch(lowerCasedSearchText, collectionItem.rawContent.toLowerCase()) || []).length > 0;
      }
      return collectionItem.rawContent.toLowerCase().includes(lowerCasedSearchText);
    });
  });
  protected readonly paginatedCollection = this.pagination.paginatedItems;
  protected readonly disablePreviousButton = this.pagination.disablePrevious;
  protected readonly disableNextButton = this.pagination.disableNext;
  protected readonly offset = this.pagination.offset;
  protected readonly scrollContainer = viewChild<ElementRef>('scrollContainer');
  protected readonly apiLoadNetworkStatus = this.apiState.state.loadNetworkStatus;
  protected readonly collectionLength = computed(() => this.mainCollectionState.state.collection().length);
  protected readonly permissionAdd = computed(() => this.mainState.state.permissions().create);

  constructor() {
    this.pagination.setCollectionSource(this.filteredCollection);

    effect(() => {
      this.collectionState.state.searchText();
      this.resetScrollPosition();
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

  protected onFirstPage(): void {
    this.pagination.firstPage();
    this.resetScrollPosition();
  }

  protected onPreviousPage(): void {
    this.pagination.previousPage();
    this.resetScrollPosition();
  }

  protected onNextPage(): void {
    this.pagination.nextPage();
    this.resetScrollPosition();
  }

  protected onLastPage(): void {
    this.pagination.lastPage();
    this.resetScrollPosition();
  }

  private resetScrollPosition(): void {
    this.scrollContainer()!.nativeElement.scrollTo({
      top: 0,
      left: 1000,
      behavior: 'smooth',
    });
  }
}
